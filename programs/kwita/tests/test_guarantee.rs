mod common;
use common::*;

#[test]
fn guarantee_raises_beneficiary_limit_and_lowers_guarantor() {
    let (mut env, f) = Env::setup(3);
    env.pay(&f[0], &f[1], 150 * UNIT).unwrap();
    assert_err(env.pay(&f[0], &f[2], 100 * UNIT), 6004);
    env.give(&f[2], &f[0], 100 * UNIT).unwrap();
    env.pay(&f[0], &f[2], 100 * UNIT).unwrap();
    let c = env.circle_state();
    assert_eq!(env.member(&f[0].key()).limit(&c), 300 * UNIT as i128);
    // f2: kaucja 200 + 50% z 100 sprzedaży - 100 poręczenia
    assert_eq!(env.member(&f[2].key()).limit(&c), 150 * UNIT as i128);
    assert_eq!(env.guarantee(&f[2].key(), &f[0].key()).amount, 100 * UNIT);
    env.assert_invariants(&[f[0].key(), f[1].key(), f[2].key()]);
}

#[test]
fn guarantee_beyond_own_limit_rejected() {
    let (mut env, f) = Env::setup(3);
    env.pay(&f[1], &f[2], 150 * UNIT).unwrap(); // f1 = -150, limit 200
    assert_err(env.give(&f[1], &f[0], 60 * UNIT), 6004); // limit 140 < 150
    env.give(&f[1], &f[0], 50 * UNIT).unwrap();
}

#[test]
fn self_guarantee_and_zero_rejected() {
    let (mut env, f) = Env::setup(2);
    assert!(env.give(&f[0], &f[0], UNIT).is_err());
    assert_err(env.give(&f[0], &f[1], 0), 6001);
}

#[test]
fn withdraw_in_use_rejected_then_allowed_after_repay() {
    let (mut env, f) = Env::setup(3);
    env.give(&f[2], &f[0], 100 * UNIT).unwrap();
    env.pay(&f[0], &f[1], 250 * UNIT).unwrap(); // korzysta z poręczenia
    assert_err(env.withdraw(&f[2], &f[0], 100 * UNIT), 6008);
    env.pay(&f[1], &f[0], 250 * UNIT).unwrap(); // spłata sprzedażą
    env.withdraw(&f[2], &f[0], 100 * UNIT).unwrap();
    assert_eq!(env.guarantee(&f[2].key(), &f[0].key()).amount, 0);
    assert_eq!(env.member(&f[2].key()).guarantees_given, 0);
    assert_eq!(env.member(&f[0].key()).guarantees_received, 0);
}

#[test]
fn withdraw_more_than_given_rejected() {
    let (mut env, f) = Env::setup(2);
    env.give(&f[1], &f[0], 10 * UNIT).unwrap();
    assert_err(env.withdraw(&f[1], &f[0], 11 * UNIT), 6007);
}

#[test]
fn guarantee_logs_explain_limits() {
    let (mut env, f) = Env::setup(2);
    let logs = env.give_logs(&f[1], &f[0], 100 * UNIT).unwrap().join("\n");
    assert!(
        logs.contains("Kwita: poręczenie 100 tPLN. Limit poręczyciela: 100 tPLN, limit firmy z poręczeniem: 300 tPLN."),
        "{logs}"
    );
}
