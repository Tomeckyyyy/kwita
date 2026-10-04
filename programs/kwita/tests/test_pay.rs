mod common;
use common::*;

#[test]
fn pay_moves_balances_and_counts_sales() {
    let (mut env, f) = Env::setup(2);
    env.pay(&f[0], &f[1], 150 * UNIT).unwrap();
    assert_eq!(env.member(&f[0].key()).balance, -150 * UNIT as i64);
    assert_eq!(env.member(&f[1].key()).balance, 150 * UNIT as i64);
    assert_eq!(env.member(&f[1].key()).counted_sales, 150 * UNIT);
    env.assert_invariants(&[f[0].key(), f[1].key()]);
}

#[test]
fn pay_over_limit_rejected() {
    let (mut env, f) = Env::setup(2);
    env.pay(&f[0], &f[1], 150 * UNIT).unwrap();
    assert_err(env.pay(&f[0], &f[1], 51 * UNIT), 6004);
    env.pay(&f[0], &f[1], 50 * UNIT).unwrap(); // dokładnie do limitu
    assert_eq!(env.member(&f[0].key()).balance, -200 * UNIT as i64);
}

#[test]
fn pay_zero_and_long_ref_rejected() {
    let (mut env, f) = Env::setup(2);
    assert_err(env.pay(&f[0], &f[1], 0), 6001);
    assert_err(env.pay_ref(&f[0], &f[1], UNIT, &"x".repeat(65)), 6005);
}

#[test]
fn pay_to_self_rejected() {
    let (mut env, f) = Env::setup(1);
    assert!(env.pay(&f[0], &f[0], UNIT).is_err());
}

#[test]
fn negative_since_set_and_cleared() {
    let (mut env, f) = Env::setup(2);
    env.pay(&f[0], &f[1], 100 * UNIT).unwrap();
    let since = env.member(&f[0].key()).negative_since;
    assert!(since > 0);
    env.warp(10);
    env.pay(&f[0], &f[1], 10 * UNIT).unwrap(); // dalej na minusie: termin się nie przesuwa
    assert_eq!(env.member(&f[0].key()).negative_since, since);
    env.pay(&f[1], &f[0], 110 * UNIT).unwrap(); // wraca do 0
    assert_eq!(env.member(&f[0].key()).negative_since, 0);
}

#[test]
fn sales_from_one_buyer_capped() {
    // pułap 100 tPLN sprzedaży liczonej od jednego kupującego
    let env = Env::with_params(DEPOSIT, BPS, 100 * UNIT, MAX_SALES, DEFAULT_AFTER).unwrap();
    let (mut env, f) = Env::setup_with(env, 3);
    env.pay(&f[0], &f[1], 150 * UNIT).unwrap();
    assert_eq!(env.member(&f[1].key()).counted_sales, 100 * UNIT);
    env.pay(&f[2], &f[1], 50 * UNIT).unwrap(); // inny kupujący liczy się osobno
    assert_eq!(env.member(&f[1].key()).counted_sales, 150 * UNIT);
    env.assert_invariants(&[f[0].key(), f[1].key(), f[2].key()]);
}

#[test]
fn wash_trading_between_two_firms_gives_no_limit() {
    let (mut env, f) = Env::setup(2);
    for _ in 0..4 {
        env.pay(&f[0], &f[1], 150 * UNIT).unwrap();
        env.pay(&f[1], &f[0], 150 * UNIT).unwrap();
    }
    assert_eq!(env.member(&f[0].key()).counted_sales, 0);
    assert_eq!(env.member(&f[1].key()).counted_sales, 0);
    assert_eq!(env.member(&f[0].key()).limit(&env.circle_state()), DEPOSIT as i128);
}

#[test]
fn buying_back_reduces_own_sales_credit() {
    let (mut env, f) = Env::setup(2);
    env.pay(&f[1], &f[0], 200 * UNIT).unwrap(); // f0 sprzedaje 200
    assert_eq!(env.member(&f[0].key()).counted_sales, 200 * UNIT);
    env.pay(&f[0], &f[1], 150 * UNIT).unwrap(); // f0 odkupuje 150 od tej samej firmy
    assert_eq!(env.member(&f[0].key()).counted_sales, 50 * UNIT);
    assert_eq!(env.member(&f[1].key()).counted_sales, 0);
}

#[test]
fn buyer_limit_uses_credit_after_buying_back() {
    let (mut env, f) = Env::setup(2);
    env.pay(&f[1], &f[0], 200 * UNIT).unwrap(); // f0: +200, limit 300
    // zakup 450 od tej samej firmy kasuje kredyt ze sprzedaży: limit 200, saldo -250 -> odmowa
    assert_err(env.pay(&f[0], &f[1], 450 * UNIT), 6004);
    env.pay(&f[0], &f[1], 400 * UNIT).unwrap(); // saldo -200 = limit 200
}

#[test]
fn pay_logs_explain_decision() {
    let (mut env, f) = Env::setup(2);
    let ok = env.pay_logs(&f[0], &f[1], 150 * UNIT, "FV/1").unwrap().join("\n");
    assert!(ok.contains("Kwita: limit 200 tPLN, saldo po zakupie -150 tPLN. Płatność przyjęta."), "{ok}");
    let err = env.pay_logs(&f[0], &f[1], 100 * UNIT, "FV/2").unwrap_err().meta.logs.join("\n");
    assert!(err.contains("Kwita: saldo po zakupie -250 tPLN przekracza limit 200 tPLN. Odmowa."), "{err}");
}

#[test]
fn sales_raise_limit() {
    let (mut env, f) = Env::setup(3);
    env.pay(&f[1], &f[0], 200 * UNIT).unwrap(); // f0 sprzedaje 200 → limit 200 + 100
    env.pay(&f[0], &f[2], 300 * UNIT).unwrap(); // f0: +200 - 300 = -100, w limicie
    assert_eq!(env.member(&f[0].key()).limit(&env.circle_state()), 300 * UNIT as i128);
}

#[test]
fn seller_positive_balance_capped() {
    let env = Env::with_params_full(DEPOSIT, BPS, CAP, MAX_SALES, DEFAULT_AFTER, 100 * UNIT).unwrap();
    let (mut env, f) = Env::setup_with(env, 2);
    env.pay(&f[0], &f[1], 100 * UNIT).unwrap(); // saldo sprzedawcy = pułap
    let err = env.pay_logs(&f[0], &f[1], UNIT, "FV/x").unwrap_err();
    assert!(format!("{:?}", err.err).contains("Custom(6019)"), "{:?}", err.err);
    let logs = err.meta.logs.join("\n");
    assert!(logs.contains("Kwita: saldo sprzedawcy po płatności 101 tPLN przekroczy pułap 100 tPLN. Odmowa."), "{logs}");
}
