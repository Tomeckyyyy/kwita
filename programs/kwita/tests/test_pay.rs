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
    let (mut env, f) = Env::setup(3);
    // f0 i f1 sprzedają sobie w kółko: liczy się max CAP od jednego kupującego
    for _ in 0..4 {
        env.pay(&f[0], &f[1], 150 * UNIT).unwrap();
        env.pay(&f[1], &f[0], 150 * UNIT).unwrap();
    }
    assert_eq!(env.member(&f[1].key()).counted_sales, CAP);
    assert_eq!(env.member(&f[0].key()).counted_sales, CAP);
    // sprzedaż do innej firmy liczy się osobno
    env.pay(&f[2], &f[1], 100 * UNIT).unwrap();
    assert_eq!(env.member(&f[1].key()).counted_sales, CAP + 100 * UNIT);
    env.assert_invariants(&[f[0].key(), f[1].key(), f[2].key()]);
}

#[test]
fn sales_raise_limit() {
    let (mut env, f) = Env::setup(3);
    env.pay(&f[1], &f[0], 200 * UNIT).unwrap(); // f0 sprzedaje 200 → limit 200 + 100
    env.pay(&f[0], &f[2], 300 * UNIT).unwrap(); // f0: +200 - 300 = -100, w limicie
    assert_eq!(env.member(&f[0].key()).limit(&env.circle_state()), 300 * UNIT as i128);
}
