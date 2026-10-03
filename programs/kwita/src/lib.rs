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
}
