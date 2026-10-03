mod common;
use common::*;

#[test]
fn leave_with_debt_covered_by_deposit() {
    let (mut env, f) = Env::setup(2);
    env.pay(&f[0], &f[1], 150 * UNIT).unwrap();
    env.leave(&f[0], false).unwrap();
    let m = env.member(&f[0].key());
    assert_eq!(m.status, kwita::MemberStatus::Exited);
    assert_eq!((m.balance, m.deposit), (0, 0));
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
    env.give(&f[2], &f[0], 100 * UNIT).unwrap();
    env.pay(&f[0], &f[1], 250 * UNIT).unwrap();
    assert_err(env.leave(&f[0], false), 6012);
}

#[test]
fn pay_to_exited_member_rejected() {
    let (mut env, f) = Env::setup(2);
    env.leave(&f[1], false).unwrap();
    assert_err(env.pay(&f[0], &f[1], UNIT), 6003);
    assert_err(env.leave(&f[1], false), 6003);
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
