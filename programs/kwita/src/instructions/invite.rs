use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::KwitaError,
    events::{InviteRevoked, MemberInvited},
    fmt::short,
    state::*,
};

/// Zaprasza każda aktywna firma z kręgu. Nie ma admina ani bramkarza.
#[derive(Accounts)]
#[instruction(invitee: Pubkey)]
pub struct InviteFirm<'info> {
    #[account(mut)]
    pub inviter: Signer<'info>,
    pub circle: Account<'info, Circle>,
    /// CHECK: konto `Member` zapraszającego; sprawdzane w handlerze, żeby nie-członek
    /// dostał czytelny błąd zamiast „konto nie istnieje”.
    #[account(seeds = [MEMBER_SEED, circle.key().as_ref(), inviter.key().as_ref()], bump)]
    pub inviter_member: UncheckedAccount<'info>,
    #[account(
        init,
        payer = inviter,
        space = 8 + Invite::INIT_SPACE,
        seeds = [INVITE_SEED, circle.key().as_ref(), invitee.as_ref()],
        bump
    )]
    pub invite: Account<'info, Invite>,
    pub system_program: Program<'info, System>,
}

pub fn handle_invite(ctx: Context<InviteFirm>, invitee: Pubkey) -> Result<()> {
    let inviter = ctx.accounts.inviter.key();
    require_keys_neq!(invitee, inviter, KwitaError::CannotInviteSelf);
    let info = ctx.accounts.inviter_member.to_account_info();
    let active = info.owner == &crate::ID
        && !info.data_is_empty()
        && Member::try_deserialize(&mut &info.data.borrow()[..])
            .map(|m| m.status == MemberStatus::Active)
            .unwrap_or(false);
    if !active {
        msg!("Kwita: zapraszający nie jest aktywną firmą w kręgu. Odmowa.");
        return err!(KwitaError::InviterNotActive);
    }
    let circle = ctx.accounts.circle.key();
    let inv = &mut ctx.accounts.invite;
    inv.circle = circle;
    inv.inviter = inviter;
    inv.invitee = invitee;
    inv.bump = ctx.bumps.invite;
    msg!(
        "Kwita: firma {} z kręgu zaprasza {}. Zaproszenie przyjęte.",
        short(&inviter),
        short(&invitee)
    );
    emit!(MemberInvited { circle, inviter, invitee });
    Ok(())
}

/// Zapraszający wycofuje niewykorzystane zaproszenie i odzyskuje opłatę za konto.
#[derive(Accounts)]
#[instruction(invitee: Pubkey)]
pub struct RevokeInvite<'info> {
    #[account(mut)]
    pub inviter: Signer<'info>,
    pub circle: Account<'info, Circle>,
    #[account(
        mut,
        seeds = [INVITE_SEED, circle.key().as_ref(), invitee.as_ref()],
        bump = invite.bump,
        has_one = inviter @ KwitaError::WrongInviter,
        close = inviter
    )]
    pub invite: Account<'info, Invite>,
}

pub fn handle_revoke_invite(ctx: Context<RevokeInvite>, invitee: Pubkey) -> Result<()> {
    let inviter = ctx.accounts.inviter.key();
    msg!("Kwita: zaproszenie dla {} wycofane.", short(&invitee));
    emit!(InviteRevoked {
        circle: ctx.accounts.circle.key(),
        inviter,
        invitee
    });
    Ok(())
}
