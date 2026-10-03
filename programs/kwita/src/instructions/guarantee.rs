use anchor_lang::prelude::*;

use crate::{constants::*, error::KwitaError, events::GuaranteeChanged, state::*};

#[derive(Accounts)]
pub struct GiveGuarantee<'info> {
    #[account(mut)]
    pub guarantor: Signer<'info>,
    pub circle: Account<'info, Circle>,
    #[account(
        mut,
        seeds = [MEMBER_SEED, circle.key().as_ref(), guarantor.key().as_ref()],
        bump = guarantor_member.bump
    )]
    pub guarantor_member: Account<'info, Member>,
    #[account(
        mut,
        constraint = beneficiary_member.circle == circle.key() @ KwitaError::WrongCircle,
        constraint = beneficiary_member.owner != guarantor.key() @ KwitaError::SelfGuarantee,
    )]
    pub beneficiary_member: Account<'info, Member>,
    #[account(
        init_if_needed,
        payer = guarantor,
        space = 8 + Guarantee::INIT_SPACE,
        seeds = [GUARANTEE_SEED, circle.key().as_ref(), guarantor.key().as_ref(), beneficiary_member.owner.as_ref()],
        bump
    )]
    pub guarantee: Account<'info, Guarantee>,
    pub system_program: Program<'info, System>,
}

pub fn handle_give_guarantee(ctx: Context<GiveGuarantee>, amount: u64) -> Result<()> {
    require!(amount > 0, KwitaError::ZeroAmount);
    let circle = &ctx.accounts.circle;
    let g = &mut ctx.accounts.guarantor_member;
    let b = &mut ctx.accounts.beneficiary_member;
    require!(
        g.status == MemberStatus::Active && b.status == MemberStatus::Active,
        KwitaError::NotActive
    );
    g.guarantees_given = g
        .guarantees_given
        .checked_add(amount)
        .ok_or(KwitaError::MathOverflow)?;
    require!(g.within_limit(circle), KwitaError::LimitExceeded);
    b.guarantees_received = b
        .guarantees_received
        .checked_add(amount)
        .ok_or(KwitaError::MathOverflow)?;
    let gu = &mut ctx.accounts.guarantee;
    gu.guarantor = g.owner;
    gu.beneficiary = b.owner;
    gu.amount = gu.amount.checked_add(amount).ok_or(KwitaError::MathOverflow)?;
    gu.bump = ctx.bumps.guarantee;
    emit!(GuaranteeChanged {
        circle: circle.key(),
        guarantor: g.owner,
        beneficiary: b.owner,
        amount: gu.amount
    });
    Ok(())
}

#[derive(Accounts)]
pub struct WithdrawGuarantee<'info> {
    pub guarantor: Signer<'info>,
    pub circle: Account<'info, Circle>,
    #[account(
        mut,
        seeds = [MEMBER_SEED, circle.key().as_ref(), guarantor.key().as_ref()],
        bump = guarantor_member.bump
    )]
    pub guarantor_member: Account<'info, Member>,
    #[account(mut, constraint = beneficiary_member.circle == circle.key() @ KwitaError::WrongCircle)]
    pub beneficiary_member: Account<'info, Member>,
    #[account(
        mut,
        seeds = [GUARANTEE_SEED, circle.key().as_ref(), guarantor.key().as_ref(), beneficiary_member.owner.as_ref()],
        bump = guarantee.bump
    )]
    pub guarantee: Account<'info, Guarantee>,
}

pub fn handle_withdraw_guarantee(ctx: Context<WithdrawGuarantee>, amount: u64) -> Result<()> {
    require!(amount > 0, KwitaError::ZeroAmount);
    let circle = &ctx.accounts.circle;
    let gu = &mut ctx.accounts.guarantee;
    require!(gu.amount >= amount, KwitaError::GuaranteeTooSmall);
    let g = &mut ctx.accounts.guarantor_member;
    let b = &mut ctx.accounts.beneficiary_member;
    gu.amount -= amount;
    g.guarantees_given -= amount;
    b.guarantees_received -= amount;
    if b.status == MemberStatus::Active {
        require!(b.within_limit(circle), KwitaError::GuaranteeInUse);
    }
    emit!(GuaranteeChanged {
        circle: circle.key(),
        guarantor: g.owner,
        beneficiary: b.owner,
        amount: gu.amount
    });
    Ok(())
}
