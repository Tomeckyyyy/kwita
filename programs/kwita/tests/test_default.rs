mod common;
use anchor_lang::{solana_program::instruction::AccountMeta, InstructionData, ToAccountMetas};
use common::*;

#[test]
fn default_too_early_and_not_negative_rejected() {
    let (mut env, f) = Env::setup(2);
    assert_err(env.default_member(&f[1], &f[0], &[]), 6014);
    env.pay(&f[0], &f[1], 100 * UNIT).unwrap();
    env.warp(DEFAULT_AFTER - 1);
    assert_err(env.default_member(&f[1], &f[0], &[]), 6015);
}

#[test]
fn default_covered_by_deposit() {
    let (mut env, f) = Env::setup(2);
    env.pay(&f[0], &f[1], 150 * UNIT).unwrap();
    env.warp(DEFAULT_AFTER);
    env.default_member(&f[1], &f[0], &[]).unwrap();
    let m = env.member(&f[0].key());
    assert_eq!(m.status, kwita::MemberStatus::Defaulted);
    assert_eq!((m.balance, m.deposit), (0, 0));
    let c = env.circle_state();
    assert_eq!(c.reserve_usdc, DEPOSIT); // kaucja przepada w całości
    assert_eq!(c.reserve_balance, -150 * UNIT as i64);
    assert_eq!(c.unbacked_loss, 0);
    env.assert_invariants(&[f[0].key(), f[1].key()]);
}

#[test]
fn default_moves_rest_to_guarantor() {
    let (mut env, f) = Env::setup(3);
    env.give(&f[2], &f[0], 100 * UNIT).unwrap();
    env.pay(&f[0], &f[1], 280 * UNIT).unwrap();
    env.warp(DEFAULT_AFTER);
    env.default_member(&f[1], &f[0], &[&f[2]]).unwrap();
    let g = env.member(&f[2].key());
    assert_eq!(g.balance, -80 * UNIT as i64); // 280 - 200 kaucji
    assert_eq!(g.guarantees_given, 0);
    assert!(g.negative_since > 0);
    assert_eq!(env.guarantee(&f[2].key(), &f[0].key()).amount, 0);
    assert_eq!(env.circle_state().unbacked_loss, 0);
    env.assert_invariants(&[f[0].key(), f[1].key(), f[2].key()]);
}

#[test]
fn default_without_guarantor_accounts_rejected() {
    // Poręczyciel nie może uciec od odpowiedzialności, pomijając swoje poręczenie.
    let (mut env, f) = Env::setup(3);
    env.give(&f[2], &f[0], 100 * UNIT).unwrap();
    env.pay(&f[0], &f[1], 280 * UNIT).unwrap();
    env.warp(DEFAULT_AFTER);
    assert_err(env.default_member(&f[2], &f[0], &[]), 6016);
}

#[test]
fn default_beyond_deposit_and_guarantee_records_unbacked_loss() {
    let (mut env, f) = Env::setup(3);
    env.give(&f[2], &f[0], 50 * UNIT).unwrap();
    env.pay(&f[0], &f[1], 250 * UNIT).unwrap();
    env.warp(DEFAULT_AFTER);
    env.default_member(&f[1], &f[0], &[&f[2]]).unwrap();
    assert_eq!(env.member(&f[2].key()).balance, -50 * UNIT as i64);
    assert_eq!(env.circle_state().unbacked_loss, 0);
    // drugi przypadek: limit 200 kaucji + 20 ze sprzedaży + 30 poręczenia; dług 250 -> 20 niepokryte
    let (mut env, f) = Env::setup(3);
    env.give(&f[2], &f[0], 30 * UNIT).unwrap();
    env.pay(&f[1], &f[0], 40 * UNIT).unwrap();
    env.pay(&f[0], &f[1], 290 * UNIT).unwrap();
    env.warp(DEFAULT_AFTER);
    env.default_member(&f[1], &f[0], &[&f[2]]).unwrap();
    assert_eq!(env.circle_state().unbacked_loss, 20 * UNIT);
    env.assert_invariants(&[f[0].key(), f[1].key(), f[2].key()]);
}

#[test]
fn defaulted_guarantor_is_not_charged() {
    // G poręcza za B, G staje się niewypłacalny; przy niewypłacalności B dług nie trafia na G.
    let (mut env, f) = Env::setup(4);
    let (g, b, s) = (&f[0], &f[1], &f[2]);
    env.give(g, b, 100 * UNIT).unwrap();
    env.pay(g, s, 50 * UNIT).unwrap(); // G na minusie
    env.pay(b, s, 280 * UNIT).unwrap(); // B korzysta z poręczenia
    env.warp(DEFAULT_AFTER);
    env.default_member(s, g, &[]).unwrap();
    env.default_member(s, b, &[g]).unwrap();
    assert_eq!(env.member(&g.key()).balance, 0);
    assert_eq!(env.circle_state().unbacked_loss, 80 * UNIT);
    env.assert_invariants(&[f[0].key(), f[1].key(), f[2].key(), f[3].key()]);
}

#[test]
fn duplicated_guarantee_pair_charges_once() {
    let (mut env, f) = Env::setup(3);
    env.give(&f[2], &f[0], 100 * UNIT).unwrap();
    env.pay(&f[0], &f[1], 280 * UNIT).unwrap();
    env.warp(DEFAULT_AFTER);
    env.default_member(&f[1], &f[0], &[&f[2], &f[2]]).unwrap();
    assert_eq!(env.member(&f[2].key()).balance, -80 * UNIT as i64);
    env.assert_invariants(&[f[0].key(), f[1].key(), f[2].key()]);
}

#[test]
fn pay_to_defaulted_member_rejected() {
    let (mut env, f) = Env::setup(3);
    env.pay(&f[0], &f[1], 100 * UNIT).unwrap();
    env.warp(DEFAULT_AFTER);
    env.default_member(&f[1], &f[0], &[]).unwrap();
    assert_err(env.pay(&f[2], &f[0], UNIT), 6003);
}

#[test]
fn default_with_foreign_guarantee_rejected() {
    let (mut env, f) = Env::setup(4);
    env.give(&f[2], &f[3], 50 * UNIT).unwrap(); // poręczenie za f3, nie za f0
    env.pay(&f[0], &f[1], 150 * UNIT).unwrap();
    env.warp(DEFAULT_AFTER);
    // podsuwamy poręczenie f2 -> f3 jako poręczenie za f0
    let mut metas = kwita::accounts::DeclareDefault {
        caller: f[1].key(),
        circle: env.circle,
        member: member_pda(&env.circle, &f[0].key()),
    }
    .to_account_metas(None);
    metas.push(AccountMeta::new(guarantee_pda(&env.circle, &f[2].key(), &f[3].key()), false));
    metas.push(AccountMeta::new(member_pda(&env.circle, &f[2].key()), false));
    let i = ix(kwita::instruction::DeclareDefault {}.data(), metas);
    let kp = f[1].kp.insecure_clone();
    assert_err(send(&mut env.svm, &[i], &kp, &[]), 6016);
}

#[test]
fn second_default_rejected() {
    let (mut env, f) = Env::setup(2);
    env.pay(&f[0], &f[1], 100 * UNIT).unwrap();
    env.warp(DEFAULT_AFTER);
    env.default_member(&f[1], &f[0], &[]).unwrap();
    assert_err(env.default_member(&f[1], &f[0], &[]), 6003);
    assert_err(env.leave(&f[0], false), 6003);
}
