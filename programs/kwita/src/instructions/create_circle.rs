use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{constants::*, error::KwitaError, events::CircleCreated, state::Circle};

#[derive(Accounts)]
#[instruction(circle_id: u64)]
pub struct CreateCircle<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(
        init,
        payer = creator,
        space = 8 + Circle::INIT_SPACE,
        seeds = [CIRCLE_SEED, creator.key().as_ref(), &circle_id.to_le_bytes()],
        bump
    )]
    pub circle: Account<'info, Circle>,
    pub collateral_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = creator,
        seeds = [VAULT_SEED, circle.key().as_ref()],
        bump,
        token::mint = collateral_mint,
        token::authority = circle,
    )]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handle_create_circle(
    ctx: Context<CreateCircle>,
    circle_id: u64,
    deposit_amount: u64,
    sales_limit_bps: u16,
    per_counterparty_cap: u64,
    max_sales_credit: u64,
    default_after_secs: i64,
) -> Result<()> {
    require!(
        deposit_amount > 0 && sales_limit_bps <= 10_000 && default_after_secs > 0,
        KwitaError::InvalidParams
    );
    let circle = &mut ctx.accounts.circle;
    circle.creator = ctx.accounts.creator.key();
    circle.circle_id = circle_id;
    circle.collateral_mint = ctx.accounts.collateral_mint.key();
    circle.vault = ctx.accounts.vault.key();
    circle.deposit_amount = deposit_amount;
    circle.sales_limit_bps = sales_limit_bps;
    circle.per_counterparty_cap = per_counterparty_cap;
    circle.max_sales_credit = max_sales_credit;
    circle.default_after_secs = default_after_secs;
    circle.reserve_balance = 0;
    circle.reserve_usdc = 0;
    circle.unbacked_loss = 0;
    circle.member_count = 0;
    circle.bump = ctx.bumps.circle;
    emit!(CircleCreated {
        circle: circle.key(),
        creator: circle.creator,
        circle_id
    });
    Ok(())
}
