use anchor_lang::prelude::*;

use crate::{constants::*, error::KwitaError, events::PaymentMade, state::*};

#[derive(Accounts)]
pub struct Pay<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    pub circle: Account<'info, Circle>,
    #[account(
        mut,
        seeds = [MEMBER_SEED, circle.key().as_ref(), buyer.key().as_ref()],
        bump = buyer_member.bump
    )]
    pub buyer_member: Account<'info, Member>,
    #[account(
        mut,
        constraint = seller_member.circle == circle.key() @ KwitaError::WrongCircle,
        constraint = seller_member.owner != buyer.key() @ KwitaError::SelfPayment,
    )]
    pub seller_member: Account<'info, Member>,
    #[account(
        init_if_needed,
        payer = buyer,
        space = 8 + Pair::INIT_SPACE,
        seeds = [PAIR_SEED, circle.key().as_ref(), seller_member.owner.as_ref(), buyer.key().as_ref()],
        bump
    )]
    pub pair: Account<'info, Pair>,
    pub system_program: Program<'info, System>,
}

pub fn handle_pay(ctx: Context<Pay>, amount: u64, invoice_ref: String) -> Result<()> {
    require!(amount > 0, KwitaError::ZeroAmount);
    require!(
        invoice_ref.len() <= MAX_INVOICE_REF_LEN,
        KwitaError::InvoiceRefTooLong
    );
    let circle = &ctx.accounts.circle;
    let buyer = &mut ctx.accounts.buyer_member;
    let seller = &mut ctx.accounts.seller_member;
    require!(
        buyer.status == MemberStatus::Active && seller.status == MemberStatus::Active,
        KwitaError::NotActive
    );
    let amount_i = i64::try_from(amount).map_err(|_| error!(KwitaError::MathOverflow))?;
    let new_buyer = buyer
        .balance
        .checked_sub(amount_i)
        .ok_or(KwitaError::MathOverflow)?;
    require!(
        new_buyer as i128 >= -buyer.limit(circle),
        KwitaError::LimitExceeded
    );

    let now = Clock::get()?.unix_timestamp;
    if buyer.balance >= 0 && new_buyer < 0 {
        buyer.negative_since = now;
    }
    buyer.balance = new_buyer;
    seller.balance = seller
        .balance
        .checked_add(amount_i)
        .ok_or(KwitaError::MathOverflow)?;
    if seller.balance >= 0 {
        seller.negative_since = 0;
    }

    let pair = &mut ctx.accounts.pair;
    pair.bump = ctx.bumps.pair;
    let counted = circle
        .per_counterparty_cap
        .saturating_sub(pair.counted)
        .min(amount);
    pair.counted += counted;
    seller.counted_sales = seller
        .counted_sales
        .checked_add(counted)
        .ok_or(KwitaError::MathOverflow)?;

    emit!(PaymentMade {
        circle: circle.key(),
        buyer: buyer.owner,
        seller: seller.owner,
        amount,
        counted,
        invoice_ref,
    });
    Ok(())
}
