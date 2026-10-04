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
    assert_eq!(c.max_positive_balance, MAX_POSITIVE);
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

#[test]
fn join_takes_deposit_and_sets_limit() {
    let mut env = Env::new();
    let a = env.firm();
    env.join(&a).unwrap();
    let m = env.member(&a.key());
    assert_eq!(m.balance, 0);
    assert_eq!(m.deposit, DEPOSIT);
    assert_eq!(m.status, kwita::MemberStatus::Active);
    assert_eq!(m.limit(&env.circle_state()), DEPOSIT as i128);
    assert_eq!(env.tokens(&a.ata), 800 * UNIT);
    assert_eq!(env.circle_state().member_count, 1);
    env.assert_invariants(&[a.key()]);
}

#[test]
fn join_twice_fails() {
    let mut env = Env::new();
    let a = env.firm();
    env.join(&a).unwrap();
    assert!(env.join(&a).is_err());
}

#[test]
fn join_logs_explain_limit() {
    let mut env = Env::new();
    let a = env.firm();
    let logs = env.join_logs(&a).unwrap().join("\n");
    assert!(logs.contains("Kwita: dołączenie do kręgu. Kaucja 200 tPLN, limit 200 tPLN."), "{logs}");
}
