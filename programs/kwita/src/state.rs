use anchor_lang::prelude::*;

use crate::constants::BPS_DENOMINATOR;

#[account]
#[derive(InitSpace)]
pub struct Circle {
    pub creator: Pubkey,
    pub circle_id: u64,
    pub collateral_mint: Pubkey,
    pub vault: Pubkey,
    pub deposit_amount: u64,
    pub sales_limit_bps: u16,
    pub per_counterparty_cap: u64,
    pub max_sales_credit: u64,
    pub default_after_secs: i64,
    pub reserve_balance: i64,
    pub reserve_usdc: u64,
    pub unbacked_loss: u64,
    pub member_count: u32,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum MemberStatus {
    Active,
    Exited,
    Defaulted,
}

#[account]
#[derive(InitSpace)]
pub struct Member {
    pub circle: Pubkey,
    pub owner: Pubkey,
    pub balance: i64,
    pub deposit: u64,
    pub counted_sales: u64,
    pub guarantees_given: u64,
    pub guarantees_received: u64,
    pub negative_since: i64,
    pub status: MemberStatus,
    pub bump: u8,
}

impl Member {
    /// limit = kaucja + min(pułap, sprzedaż * bps) + poręczenia otrzymane - dane
    pub fn limit(&self, circle: &Circle) -> i128 {
        let sales_credit = (self.counted_sales as u128 * circle.sales_limit_bps as u128
            / BPS_DENOMINATOR)
            .min(circle.max_sales_credit as u128);
        self.deposit as i128 + sales_credit as i128 + self.guarantees_received as i128
            - self.guarantees_given as i128
    }

    pub fn within_limit(&self, circle: &Circle) -> bool {
        self.balance as i128 >= -self.limit(circle)
    }
}

#[account]
#[derive(InitSpace)]
pub struct Pair {
    pub counted: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Guarantee {
    pub guarantor: Pubkey,
    pub beneficiary: Pubkey,
    pub amount: u64,
    pub bump: u8,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn circle() -> Circle {
        Circle {
            creator: Pubkey::default(),
            circle_id: 0,
            collateral_mint: Pubkey::default(),
            vault: Pubkey::default(),
            deposit_amount: 200,
            sales_limit_bps: 5_000,
            per_counterparty_cap: 300,
            max_sales_credit: 1_000,
            default_after_secs: 60,
            reserve_balance: 0,
            reserve_usdc: 0,
            unbacked_loss: 0,
            member_count: 0,
            bump: 0,
        }
    }

    fn member(deposit: u64, sales: u64, received: u64, given: u64, balance: i64) -> Member {
        Member {
            circle: Pubkey::default(),
            owner: Pubkey::default(),
            balance,
            deposit,
            counted_sales: sales,
            guarantees_given: given,
            guarantees_received: received,
            negative_since: 0,
            status: MemberStatus::Active,
            bump: 0,
        }
    }

    #[test]
    fn limit_is_deposit_for_new_member() {
        assert_eq!(member(200, 0, 0, 0, 0).limit(&circle()), 200);
    }

    #[test]
    fn limit_adds_half_of_sales_capped() {
        assert_eq!(member(200, 400, 0, 0, 0).limit(&circle()), 400);
        assert_eq!(member(200, 5_000, 0, 0, 0).limit(&circle()), 1_200);
    }

    #[test]
    fn limit_includes_guarantees() {
        assert_eq!(member(200, 0, 100, 0, 0).limit(&circle()), 300);
        assert_eq!(member(200, 0, 0, 150, 0).limit(&circle()), 50);
    }

    #[test]
    fn within_limit_boundary() {
        assert!(member(200, 0, 0, 0, -200).within_limit(&circle()));
        assert!(!member(200, 0, 0, 0, -201).within_limit(&circle()));
    }
}
