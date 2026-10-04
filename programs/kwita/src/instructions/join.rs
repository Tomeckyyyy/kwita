use anchor_lang::{prelude::*, AccountsClose};
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

use crate::{
    constants::*,
    error::KwitaError,
    events::MemberJoined,
    fmt::{short, tpln},
    state::*,
};

#[derive(Accounts)]
pub struct Join<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut)]
    pub circle: Account<'info, Circle>,
    #[account(
        init,
        payer = owner,
        space = 8 + Member::INIT_SPACE,
        seeds = [MEMBER_SEED, circle.key().as_ref(), owner.key().as_ref()],
        bump
    )]
    pub member: Account<'info, Member>,
    #[account(address = circle.collateral_mint)]
    pub collateral_mint: Account<'info, Mint>,
    #[account(mut, token::mint = collateral_mint, token::authority = owner)]
    pub owner_token: Account<'info, TokenAccount>,
    #[account(mut, address = circle.vault)]
    pub vault: Account<'info, TokenAccount>,
    /// Zaproszenie dla tej firmy. Wymagane, chyba że dołącza założyciel kręgu (pierwszy członek).
    /// Zużywane przy dołączeniu: konto zamknięte, opłata wraca do zapraszającego.
    #[account(
        mut,
        seeds = [INVITE_SEED, circle.key().as_ref(), owner.key().as_ref()],
        bump = invite.bump
    )]
    pub invite: Option<Account<'info, Invite>>,
    /// CHECK: zapraszający z konta zaproszenia (odbiera zwrot opłaty); zgodność sprawdza handler.
    #[account(mut)]
    pub inviter: Option<UncheckedAccount<'info>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handle_join(ctx: Context<Join>) -> Result<()> {
    let owner_key = ctx.accounts.owner.key();
    match (&ctx.accounts.invite, &ctx.accounts.inviter) {
        (Some(invite), Some(inviter)) => {
            require_keys_eq!(inviter.key(), invite.inviter, KwitaError::WrongInviter);
            msg!("Kwita: zaproszenie od firmy {}. Zaproszenie zużyte.", short(&invite.inviter));
            invite.close(inviter.to_account_info())?;
        }
        (Some(_), None) => return err!(KwitaError::WrongInviter),
        (None, _) if owner_key == ctx.accounts.circle.creator => {
            msg!("Kwita: założyciel kręgu dołącza bez zaproszenia.");
        }
        (None, _) => {
            msg!("Kwita: brak zaproszenia do kręgu. Odmowa.");
            return err!(KwitaError::NotInvited);
        }
    }
    let deposit = ctx.accounts.circle.deposit_amount;
    token::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.owner_token.to_account_info(),
                mint: ctx.accounts.collateral_mint.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        ),
        deposit,
        ctx.accounts.collateral_mint.decimals,
    )?;
    let circle_key = ctx.accounts.circle.key();
    let m = &mut ctx.accounts.member;
    m.circle = circle_key;
    m.owner = ctx.accounts.owner.key();
    m.balance = 0;
    m.deposit = deposit;
    m.counted_sales = 0;
    m.guarantees_given = 0;
    m.guarantees_received = 0;
    m.negative_since = 0;
    m.status = MemberStatus::Active;
    m.bump = ctx.bumps.member;
    let owner = m.owner;
    msg!(
        "Kwita: dołączenie do kręgu. Kaucja {} tPLN, limit {} tPLN.",
        tpln(deposit as i128),
        tpln(m.limit(&ctx.accounts.circle))
    );
    ctx.accounts.circle.member_count += 1;
    emit!(MemberJoined {
        circle: circle_key,
        owner,
        deposit
    });
    Ok(())
}
