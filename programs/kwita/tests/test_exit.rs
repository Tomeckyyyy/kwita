mod common;
use common::*;

#[test]
fn leave_with_debt_covered_by_deposit() {
    let (mut env, f) = Env::setup(2);
    env.pay(&f[0], &f[1], 150 * UNIT).unwrap();
    env.leave(&f[0], false).unwrap();
    assert!(env.member_opt(&f[0].key()).is_none(), "konto firmy zamknięte");
    assert_eq!(env.tokens(&f[0].ata), 850 * UNIT); // 800 + zwrot 50
    let c = env.circle_state();
    assert_eq!(c.reserve_usdc, 150 * UNIT);
    assert_eq!(c.reserve_balance, -150 * UNIT as i64);
    env.assert_invariants(&[f[0].key(), f[1].key()]);
}

#[test]
fn leave_at_zero_refunds_full_deposit() {
    let (mut env, f) = Env::setup(1);
    env.leave(&f[0], false).unwrap();
    assert_eq!(env.tokens(&f[0].ata), 1_000 * UNIT);
}

#[test]
fn leave_positive_requires_forfeit() {
    let (mut env, f) = Env::setup(2);
    env.pay(&f[0], &f[1], 100 * UNIT).unwrap();
    assert_err(env.leave(&f[1], false), 6013);
    env.leave(&f[1], true).unwrap();
    assert_eq!(env.circle_state().reserve_balance, 100 * UNIT as i64);
    assert_eq!(env.tokens(&f[1].ata), 1_000 * UNIT);
    env.assert_invariants(&[f[0].key(), f[1].key()]);
}

#[test]
fn leave_with_given_guarantee_rejected() {
    let (mut env, f) = Env::setup(2);
    env.give(&f[1], &f[0], 10 * UNIT).unwrap();
    assert_err(env.leave(&f[1], false), 6011);
}

#[test]
fn leave_with_debt_above_deposit_rejected() {
    let (mut env, f) = Env::setup(3);
    env.pay(&f[2], &f[0], 100 * UNIT).unwrap(); // limit f0: 200 + 50
    env.pay(&f[0], &f[1], 350 * UNIT).unwrap(); // f0 = -250, więcej niż kaucja
    assert_err(env.leave(&f[0], false), 6012);
}

#[test]
fn leave_with_received_guarantee_rejected() {
    let (mut env, f) = Env::setup(2);
    env.give(&f[1], &f[0], 10 * UNIT).unwrap();
    assert_err(env.leave(&f[0], false), 6020);
    env.withdraw(&f[1], &f[0], 10 * UNIT).unwrap();
    env.leave(&f[0], false).unwrap();
}

#[test]
fn leave_refunds_rent_and_allows_rejoin() {
    let (mut env, f) = Env::setup(1);
    let before = env.svm.get_account(&f[0].key()).unwrap().lamports;
    env.leave(&f[0], false).unwrap();
    let after = env.svm.get_account(&f[0].key()).unwrap().lamports;
    assert!(after > before, "opłata za konto wróciła do firmy");
    env.join(&f[0]).unwrap();
    assert_eq!(env.member(&f[0].key()).deposit, DEPOSIT);
}

#[test]
fn pay_to_exited_member_rejected() {
    let (mut env, f) = Env::setup(2);
    env.leave(&f[1], false).unwrap();
    assert!(env.pay(&f[0], &f[1], UNIT).is_err()); // konto zamknięte
    assert!(env.leave(&f[1], false).is_err());
}

#[test]
fn redeem_from_reserve() {
    let (mut env, f) = Env::setup(3);
    env.pay(&f[0], &f[1], 150 * UNIT).unwrap();
    env.leave(&f[0], false).unwrap(); // Rezerwa: 150 tPLN
    env.redeem(&f[1], 100 * UNIT).unwrap();
    assert_eq!(env.member(&f[1].key()).balance, 50 * UNIT as i64);
    assert_eq!(env.tokens(&f[1].ata), 900 * UNIT);
    assert_eq!(env.circle_state().reserve_usdc, 50 * UNIT);
    env.assert_invariants(&[f[0].key(), f[1].key(), f[2].key()]);
}

#[test]
fn redeem_rejections() {
    let (mut env, f) = Env::setup(2);
    env.pay(&f[0], &f[1], 100 * UNIT).unwrap();
    assert_err(env.redeem(&f[1], 10 * UNIT), 6010); // Rezerwa pusta
    assert_err(env.redeem(&f[0], 10 * UNIT), 6009); // saldo ujemne
    assert_err(env.redeem(&f[1], 0), 6001);
}
