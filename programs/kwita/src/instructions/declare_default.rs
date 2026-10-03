use anchor_lang::prelude::*;

use crate::{constants::*, error::KwitaError, events::MemberDefaulted, state::*};

#[derive(Accounts)]
pub struct DeclareDefault<'info> {
    pub caller: Signer<'info>,
    #[account(mut)]
    pub circle: Account<'info, Circle>,
    #[account(mut, constraint = member.circle == circle.key() @ KwitaError::WrongCircle)]
    pub member: Account<'info, Member>,
}

pub fn handle_declare_default<'info>(ctx: Context<'info, DeclareDefault<'info>>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let circle = &mut ctx.accounts.circle;
    let m = &mut ctx.accounts.member;
    require!(m.status == MemberStatus::Active, KwitaError::NotActive);
    require!(m.balance < 0, KwitaError::NotNegative);
    require!(
        now >= m.negative_since + circle.default_after_secs,
        KwitaError::TooEarly
    );

    let debt = m.balance.unsigned_abs();
    let mut loss = debt;

    // 1. Kaucja przepada w całości do Rezerwy; pokrywa dług do swojej wysokości.
    let from_deposit = m.deposit.min(loss);
    circle.reserve_usdc += m.deposit;
    circle.reserve_balance -= from_deposit as i64;
    loss -= from_deposit;
    m.deposit = 0;

    // 2. Poręczyciele: pary [Guarantee, Member poręczyciela].
    let rem = ctx.remaining_accounts;
    require!(rem.len() % 2 == 0, KwitaError::InvalidGuaranteeAccount);
    let mut from_guarantors = 0u64;
    for pair in rem.chunks(2) {
        let mut g: Account<'info, Guarantee> = Account::try_from(&pair[0])?;
        let mut gm: Account<'info, Member> = Account::try_from(&pair[1])?;
        let expected = Pubkey::find_program_address(
            &[
                GUARANTEE_SEED,
                circle.key().as_ref(),
                g.guarantor.as_ref(),
                g.beneficiary.as_ref(),
            ],
            &crate::ID,
        )
        .0;
        require!(
            g.key() == expected
                && g.beneficiary == m.owner
                && gm.owner == g.guarantor
                && gm.circle == circle.key(),
            KwitaError::InvalidGuaranteeAccount
        );
        let x = g.amount.min(loss);
        if x > 0 {
            let new_balance = gm.balance - x as i64;
            if gm.balance >= 0 && new_balance < 0 {
                gm.negative_since = now;
            }
            gm.balance = new_balance;
        }
        gm.guarantees_given -= g.amount;
        m.guarantees_received -= g.amount;
        g.amount = 0;
        loss -= x;
        from_guarantors += x;
        g.exit(&crate::ID)?;
        gm.exit(&crate::ID)?;
    }

    // 3. Reszta: niepokryta strata Rezerwy.
    circle.reserve_balance -= loss as i64;
    circle.unbacked_loss += loss;
    m.balance = 0;
    m.negative_since = 0;
    m.status = MemberStatus::Defaulted;

    emit!(MemberDefaulted {
        circle: circle.key(),
        owner: m.owner,
        debt,
        from_deposit,
        from_guarantors,
        unbacked: loss,
    });
    Ok(())
}
