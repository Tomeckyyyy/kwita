use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{
    constants::*, error::KwitaError, events::MemberLeft, instructions::vault::transfer_from_vault,
    state::*,
};

#[derive(Accounts)]
pub struct Leave<'info> {
    pub owner: Signer<'info>,
    #[account(mut)]
    pub circle: Account<'info, Circle>,
    #[account(
        mut,
        seeds = [MEMBER_SEED, circle.key().as_ref(), owner.key().as_ref()],
        bump = member.bump
    )]
    pub member: Account<'info, Member>,
    #[account(address = circle.collateral_mint)]
    pub collateral_mint: Account<'info, Mint>,
    #[account(mut, token::mint = collateral_mint, token::authority = owner)]
    pub owner_token: Account<'info, TokenAccount>,
    #[account(mut, address = circle.vault)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_leave(ctx: Context<Leave>, forfeit_positive: bool) -> Result<()> {
    let circle = &mut ctx.accounts.circle;
    let m = &mut ctx.accounts.member;
    require!(m.status == MemberStatus::Active, KwitaError::NotActive);
    require!(m.guarantees_given == 0, KwitaError::HasGivenGuarantees);

    let mut covered_debt = 0u64;
    let mut forfeited = 0u64;
    if m.balance < 0 {
        let need = m.balance.unsigned_abs();
        require!(m.deposit >= need, KwitaError::DepositTooSmallToLeave);
        m.deposit -= need;
        circle.reserve_usdc += need;
        circle.reserve_balance -= need as i64;
        covered_debt = need;
    } else if m.balance > 0 {
        require!(forfeit_positive, KwitaError::PositiveBalance);
        circle.reserve_balance += m.balance;
        forfeited = m.balance as u64;
    }
    m.balance = 0;
    m.negative_since = 0;
    let refunded = m.deposit;
    m.deposit = 0;
    m.status = MemberStatus::Exited;
    let (circle_key, owner) = (circle.key(), m.owner);

    if refunded > 0 {
        transfer_from_vault(
            &ctx.accounts.circle,
            &ctx.accounts.vault,
            &ctx.accounts.collateral_mint,
            &ctx.accounts.owner_token,
            &ctx.accounts.token_program,
            refunded,
        )?;
    }
    emit!(MemberLeft {
        circle: circle_key,
        owner,
        covered_debt,
        forfeited,
        refunded
    });
    Ok(())
}
