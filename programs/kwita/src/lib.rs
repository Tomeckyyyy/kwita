pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("GB8MgJJggQM7uiHwWy9nuL5AZnGbFraHVharujHKXAgk");

#[program]
pub mod kwita {
    use super::*;

    pub fn create_circle(
        ctx: Context<CreateCircle>,
        circle_id: u64,
        deposit_amount: u64,
        sales_limit_bps: u16,
        per_counterparty_cap: u64,
        max_sales_credit: u64,
        default_after_secs: i64,
    ) -> Result<()> {
        crate::instructions::create_circle::handle_create_circle(
            ctx,
            circle_id,
            deposit_amount,
            sales_limit_bps,
            per_counterparty_cap,
            max_sales_credit,
            default_after_secs,
        )
    }

    pub fn join(ctx: Context<Join>) -> Result<()> {
        crate::instructions::join::handle_join(ctx)
    }

    pub fn pay(ctx: Context<Pay>, amount: u64, invoice_ref: String) -> Result<()> {
        crate::instructions::pay::handle_pay(ctx, amount, invoice_ref)
    }

    pub fn give_guarantee(ctx: Context<GiveGuarantee>, amount: u64) -> Result<()> {
        crate::instructions::guarantee::handle_give_guarantee(ctx, amount)
    }

    pub fn withdraw_guarantee(ctx: Context<WithdrawGuarantee>, amount: u64) -> Result<()> {
        crate::instructions::guarantee::handle_withdraw_guarantee(ctx, amount)
    }

    pub fn redeem(ctx: Context<Redeem>, amount: u64) -> Result<()> {
        crate::instructions::redeem::handle_redeem(ctx, amount)
    }

    pub fn leave(ctx: Context<Leave>, forfeit_positive: bool) -> Result<()> {
        crate::instructions::leave::handle_leave(ctx, forfeit_positive)
    }

    pub fn declare_default<'info>(ctx: Context<'info, DeclareDefault<'info>>) -> Result<()> {
        crate::instructions::declare_default::handle_declare_default(ctx)
    }
}
