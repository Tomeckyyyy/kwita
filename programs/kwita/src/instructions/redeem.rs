use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{
    constants::*, error::KwitaError, events::Redeemed, fmt::tpln,
    instructions::vault::transfer_from_vault, state::*,
};

#[derive(Accounts)]
pub struct Redeem<'info> {
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

pub fn handle_redeem(ctx: Context<Redeem>, amount: u64) -> Result<()> {
    require!(amount > 0, KwitaError::ZeroAmount);
    let circle = &mut ctx.accounts.circle;
    let m = &mut ctx.accounts.member;
    require!(m.status == MemberStatus::Active, KwitaError::NotActive);
    let amount_i = i64::try_from(amount).map_err(|_| error!(KwitaError::MathOverflow))?;
    require!(m.balance >= amount_i, KwitaError::InsufficientBalance);
    require!(circle.reserve_usdc >= amount, KwitaError::ReserveEmpty);
    m.balance -= amount_i;
    circle.reserve_balance += amount_i;
    circle.reserve_usdc -= amount;
    let (circle_key, owner) = (circle.key(), m.owner);
    msg!(
        "Kwita: wymiana {} jednostek na tPLN z Rezerwy. W Rezerwie zostaje {} tPLN.",
        tpln(amount as i128),
        tpln(circle.reserve_usdc as i128)
    );

    transfer_from_vault(
        &ctx.accounts.circle,
        &ctx.accounts.vault,
        &ctx.accounts.collateral_mint,
        &ctx.accounts.owner_token,
        &ctx.accounts.token_program,
        amount,
    )?;
    emit!(Redeemed {
        circle: circle_key,
        owner,
        amount
    });
    Ok(())
}
