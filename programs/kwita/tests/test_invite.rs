mod common;
use common::*;

const NOT_ACTIVE_INVITER: u32 = 6023;
const NOT_INVITED: u32 = 6021;
const CANNOT_INVITE_SELF: u32 = 6022;
const WRONG_INVITER: u32 = 6024;

#[test]
fn founder_joins_without_invite() {
    let mut env = Env::new();
    let founder = env.firm();
    assert_eq!(founder.key(), env.creator);
    let logs = env.join_only_logs(&founder).unwrap().join("\n");
    assert!(logs.contains("Kwita: założyciel kręgu dołącza bez zaproszenia."), "{logs}");
    assert_eq!(env.circle_state().member_count, 1);
}

#[test]
fn join_without_invite_rejected() {
    let (mut env, _f) = Env::setup(1);
    let outsider = env.firm();
    let err = env.join_only_logs(&outsider).unwrap_err();
    assert!(
        err.meta.logs.join("\n").contains("Kwita: brak zaproszenia do kręgu. Odmowa."),
        "{:?}",
        err.meta.logs
    );
    assert_err(Err(err), NOT_INVITED);
    assert!(env.member_opt(&outsider.key()).is_none());
}

#[test]
fn invited_firm_joins_and_invite_is_consumed() {
    let (mut env, f) = Env::setup(1);
    let b = env.firm();
    let logs = env.invite_logs(&f[0], &b.key()).unwrap().join("\n");
    assert!(logs.contains("Zaproszenie przyjęte."), "{logs}");
    let inv = env.invite_opt(&b.key()).expect("zaproszenie istnieje");
    assert_eq!(inv.inviter, f[0].key());
    assert_eq!(inv.invitee, b.key());
    assert_eq!(inv.circle, env.circle);

    let inviter_before = env.lamports(&f[0].key());
    let logs = env.join_only_logs(&b).unwrap().join("\n");
    assert!(logs.contains("Zaproszenie zużyte."), "{logs}");
    assert!(env.invite_opt(&b.key()).is_none(), "zaproszenie zamknięte");
    assert!(env.lamports(&f[0].key()) > inviter_before, "opłata za zaproszenie wraca do zapraszającego");
    assert_eq!(env.member(&b.key()).status, kwita::MemberStatus::Active);
    assert_eq!(env.circle_state().member_count, 2);
}

#[test]
fn any_member_can_invite_not_only_founder() {
    let (mut env, f) = Env::setup(2);
    let c = env.firm();
    env.invite(&f[1], &c.key()).unwrap(); // f[1] nie jest założycielem
    env.join_only(&c).unwrap();
    // nowy członek od razu może zapraszać dalej
    let d = env.firm();
    env.invite(&c, &d.key()).unwrap();
    env.join_only(&d).unwrap();
    assert_eq!(env.circle_state().member_count, 4);
}

#[test]
fn non_member_cannot_invite() {
    let (mut env, _f) = Env::setup(1);
    let outsider = env.firm();
    let other = env.firm();
    assert_err(env.invite(&outsider, &other.key()), NOT_ACTIVE_INVITER);
    assert!(env.invite_opt(&other.key()).is_none());
}

#[test]
fn member_after_leave_cannot_invite() {
    let (mut env, f) = Env::setup(2);
    env.leave(&f[1], false).unwrap();
    let other = env.firm();
    assert_err(env.invite(&f[1], &other.key()), NOT_ACTIVE_INVITER);
}

#[test]
fn invite_works_only_once() {
    let (mut env, f) = Env::setup(1);
    let b = env.firm();
    env.invite(&f[0], &b.key()).unwrap();
    env.join_only(&b).unwrap();
    env.leave(&b, false).unwrap();
    // to samo zaproszenie nie wpuści drugi raz
    assert_err(env.join_only(&b), NOT_INVITED);
    // nowe zaproszenie: można wrócić
    env.invite(&f[0], &b.key()).unwrap();
    env.join_only(&b).unwrap();
}

#[test]
fn cannot_invite_self() {
    let (mut env, f) = Env::setup(1);
    let me = f[0].key();
    assert_err(env.invite(&f[0], &me), CANNOT_INVITE_SELF);
}

#[test]
fn invite_twice_rejected_until_used() {
    let (mut env, f) = Env::setup(2);
    let b = env.firm();
    env.invite(&f[0], &b.key()).unwrap();
    assert!(env.invite(&f[1], &b.key()).is_err(), "jedno zaproszenie na firmę naraz");
}

#[test]
fn join_with_wrong_inviter_rejected() {
    use anchor_lang::{solana_program::system_program, InstructionData, ToAccountMetas};
    let (mut env, f) = Env::setup(2);
    let b = env.firm();
    env.invite(&f[0], &b.key()).unwrap();
    // zwrot opłaty za zaproszenie próbuje przejąć ktoś inny niż zapraszający
    let i = ix(
        kwita::instruction::Join {}.data(),
        kwita::accounts::Join {
            owner: b.key(),
            circle: env.circle,
            member: member_pda(&env.circle, &b.key()),
            collateral_mint: env.mint,
            owner_token: b.ata,
            vault: env.vault,
            invite: Some(invite_pda(&env.circle, &b.key())),
            inviter: Some(f[1].key()),
            token_program: anchor_spl::token::ID,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    );
    let kp = b.kp.insecure_clone();
    assert_err(send(&mut env.svm, &[i], &kp, &[]), WRONG_INVITER);
}

#[test]
fn inviter_can_revoke_unused_invite() {
    let (mut env, f) = Env::setup(2);
    let b = env.firm();
    env.invite(&f[0], &b.key()).unwrap();
    assert!(env.revoke_invite(&f[1], &b.key()).is_err(), "wycofać może tylko zapraszający");
    let before = env.lamports(&f[0].key());
    env.revoke_invite(&f[0], &b.key()).unwrap();
    assert!(env.lamports(&f[0].key()) > before);
    assert!(env.invite_opt(&b.key()).is_none());
    assert_err(env.join_only(&b), NOT_INVITED);
}
