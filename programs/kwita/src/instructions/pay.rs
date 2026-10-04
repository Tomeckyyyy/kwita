use anchor_lang::prelude::*;

use crate::{constants::*, error::KwitaError, events::PaymentMade, fmt::tpln, state::*};

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
    /// Kierunek odwrotny (kupujący jako sprzedawca dla tej samej firmy): do sprzedaży netto.
    #[account(
        init_if_needed,
        payer = buyer,
        space = 8 + Pair::INIT_SPACE,
        seeds = [PAIR_SEED, circle.key().as_ref(), buyer.key().as_ref(), seller_member.owner.as_ref()],
        bump
    )]
    pub reverse_pair: Account<'info, Pair>,
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

    // Sprzedaż netto między tą parą firm: do limitu liczy się tylko nadwyżka sprzedaży
    // nad zakupami od tej samej firmy, z pułapem na kontrahenta. Wymiana w kółko daje zero.
    let pair = &mut ctx.accounts.pair;
    let reverse = &mut ctx.accounts.reverse_pair;
    pair.bump = ctx.bumps.pair;
    reverse.bump = ctx.bumps.reverse_pair;
    pair.volume = pair.volume.checked_add(amount).ok_or(KwitaError::MathOverflow)?;
    let net = pair.volume as i128 - reverse.volume as i128;
    let cap = circle.per_counterparty_cap as i128;
    let seller_counted = net.clamp(0, cap) as u64;
    let buyer_counted = (-net).clamp(0, cap) as u64;
    seller.counted_sales = seller.counted_sales - pair.counted + seller_counted;
    buyer.counted_sales = buyer.counted_sales - reverse.counted + buyer_counted;
    pair.counted = seller_counted;
    reverse.counted = buyer_counted;

    // Limit kupującego liczony już po zmianie jego kredytu ze sprzedaży.
    let limit = buyer.limit(circle);
    if (new_buyer as i128) < -limit {
        msg!(
            "Kwita: saldo po zakupie {} tPLN przekracza limit {} tPLN. Odmowa.",
            tpln(new_buyer as i128),
            tpln(limit)
        );
        return err!(KwitaError::LimitExceeded);
    }
    let new_seller = seller
        .balance
        .checked_add(amount_i)
        .ok_or(KwitaError::MathOverflow)?;
    let max_pos = circle.max_positive_balance as i128;
    if max_pos > 0 && new_seller as i128 > max_pos {
        msg!(
            "Kwita: saldo sprzedawcy po płatności {} tPLN przekroczy pułap {} tPLN. Odmowa.",
            tpln(new_seller as i128),
            tpln(max_pos)
        );
        return err!(KwitaError::PositiveBalanceCap);
    }
    msg!(
        "Kwita: limit {} tPLN, saldo po zakupie {} tPLN. Płatność przyjęta.",
        tpln(limit),
        tpln(new_buyer as i128)
    );

    let now = Clock::get()?.unix_timestamp;
    if buyer.balance >= 0 && new_buyer < 0 {
        buyer.negative_since = now;
    }
    buyer.balance = new_buyer;
    seller.balance = new_seller;
    if seller.balance >= 0 {
        seller.negative_since = 0;
    }
    let counted = seller_counted;

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
