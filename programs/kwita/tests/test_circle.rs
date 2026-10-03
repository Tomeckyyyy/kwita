mod common;
use common::*;

#[test]
fn create_circle_stores_params() {
    let env = Env::new();
    let c = env.circle_state();
    assert_eq!(c.deposit_amount, DEPOSIT);
    assert_eq!(c.sales_limit_bps, BPS);
    assert_eq!(c.per_counterparty_cap, CAP);
    assert_eq!(c.max_sales_credit, MAX_SALES);
    assert_eq!(c.default_after_secs, DEFAULT_AFTER);
    assert_eq!(c.vault, env.vault);
    assert_eq!(c.reserve_balance, 0);
    assert_eq!(env.tokens(&env.vault), 0);
}

#[test]
fn create_circle_rejects_bad_params() {
    for (dep, bps, def) in [(0, 5_000, 60), (DEPOSIT, 10_001, 60), (DEPOSIT, 5_000, 0)] {
        let res = Env::with_params(dep, bps, CAP, MAX_SALES, def).map(|_| ());
        assert_err(res, 6000);
    }
}
