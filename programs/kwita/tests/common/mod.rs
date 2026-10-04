#![allow(dead_code)]
use {
    anchor_lang::{
        prelude::Pubkey,
        solana_program::{instruction::Instruction, system_program},
        AccountDeserialize, InstructionData, ToAccountMetas,
    },
    litesvm::{types::FailedTransactionMetadata, LiteSVM},
    litesvm_token::{CreateAssociatedTokenAccount, CreateMint, MintTo},
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_program_pack::Pack,
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

pub const UNIT: u64 = 1_000_000; // 1 tPLN
pub const DEPOSIT: u64 = 200 * UNIT;
pub const BPS: u16 = 5_000;
pub const CAP: u64 = 300 * UNIT;
pub const MAX_SALES: u64 = 1_000 * UNIT;
pub const MAX_POSITIVE: u64 = 1_500 * UNIT;
pub const DEFAULT_AFTER: i64 = 60;
pub const CIRCLE_ID: u64 = 1;

pub struct Firm {
    pub kp: Keypair,
    pub ata: Pubkey,
}

impl Firm {
    pub fn key(&self) -> Pubkey {
        self.kp.pubkey()
    }
}

pub struct Env {
    pub svm: LiteSVM,
    pub payer: Keypair,
    pub mint: Pubkey,
    pub circle: Pubkey,
    pub vault: Pubkey,
    /// Założyciel kręgu (twórca `create_circle`); zwraca go pierwsze wywołanie `firm()`.
    pub creator: Pubkey,
    founder: Option<Firm>,
    /// Firmy, które dołączyły przez `join` (kandydaci na zapraszających).
    joined: Vec<Keypair>,
}

pub fn pda(seeds: &[&[u8]]) -> Pubkey {
    Pubkey::find_program_address(seeds, &kwita::id()).0
}

pub fn member_pda(circle: &Pubkey, owner: &Pubkey) -> Pubkey {
    pda(&[kwita::MEMBER_SEED, circle.as_ref(), owner.as_ref()])
}

pub fn pair_pda(circle: &Pubkey, seller: &Pubkey, buyer: &Pubkey) -> Pubkey {
    pda(&[kwita::PAIR_SEED, circle.as_ref(), seller.as_ref(), buyer.as_ref()])
}

pub fn invite_pda(circle: &Pubkey, invitee: &Pubkey) -> Pubkey {
    pda(&[kwita::INVITE_SEED, circle.as_ref(), invitee.as_ref()])
}

pub fn guarantee_pda(circle: &Pubkey, guarantor: &Pubkey, beneficiary: &Pubkey) -> Pubkey {
    pda(&[kwita::GUARANTEE_SEED, circle.as_ref(), guarantor.as_ref(), beneficiary.as_ref()])
}

pub fn send(
    svm: &mut LiteSVM,
    ixs: &[Instruction],
    payer: &Keypair,
    signers: &[&Keypair],
) -> Result<(), FailedTransactionMetadata> {
    send_logs(svm, ixs, payer, signers).map(|_| ())
}

/// Jak `send`, ale zwraca logi programu (także przy błędzie, w `FailedTransactionMetadata.meta.logs`).
pub fn send_logs(
    svm: &mut LiteSVM,
    ixs: &[Instruction],
    payer: &Keypair,
    signers: &[&Keypair],
) -> Result<Vec<String>, FailedTransactionMetadata> {
    svm.expire_blockhash();
    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(ixs, Some(&payer.pubkey()), &blockhash);
    let mut all: Vec<&Keypair> = vec![payer];
    all.extend_from_slice(signers);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &all).unwrap();
    svm.send_transaction(tx).map(|m| m.logs)
}

/// Sprawdza, że transakcja padła z błędem programu `code` (6000 + indeks KwitaError).
pub fn assert_err(res: Result<(), FailedTransactionMetadata>, code: u32) {
    let e = res.expect_err("transakcja miała się nie udać");
    let s = format!("{:?}", e.err);
    assert!(
        s.contains(&format!("Custom({})", code)),
        "oczekiwano Custom({code}), jest {s}\n{:?}",
        e.meta.logs
    );
}

pub fn ix(
    data: Vec<u8>,
    accounts: Vec<anchor_lang::solana_program::instruction::AccountMeta>,
) -> Instruction {
    Instruction::new_with_bytes(kwita::id(), &data, accounts)
}

fn new_firm(svm: &mut LiteSVM, payer: &Keypair, mint: &Pubkey) -> Firm {
    let kp = Keypair::new();
    svm.airdrop(&kp.pubkey(), 10_000_000_000).unwrap();
    let ata = CreateAssociatedTokenAccount::new(svm, payer, mint)
        .owner(&kp.pubkey())
        .send()
        .unwrap();
    MintTo::new(svm, payer, mint, &ata, 1_000 * UNIT).send().unwrap();
    Firm { kp, ata }
}

impl Env {
    pub fn new() -> Self {
        Self::with_params(DEPOSIT, BPS, CAP, MAX_SALES, DEFAULT_AFTER).expect("create_circle")
    }

    pub fn with_params(
        deposit: u64,
        bps: u16,
        cap: u64,
        max_sales: u64,
        default_after: i64,
    ) -> Result<Self, FailedTransactionMetadata> {
        Self::with_params_full(deposit, bps, cap, max_sales, default_after, MAX_POSITIVE)
    }

    pub fn with_params_full(
        deposit: u64,
        bps: u16,
        cap: u64,
        max_sales: u64,
        default_after: i64,
        max_positive: u64,
    ) -> Result<Self, FailedTransactionMetadata> {
        let mut svm = LiteSVM::new();
        let bytes = include_bytes!(concat!(env!("CARGO_TARGET_TMPDIR"), "/../deploy/kwita.so"));
        svm.add_program(kwita::id(), bytes).unwrap();
        // LiteSVM startuje od unix_timestamp = 0, a 0 w negative_since znaczy „nie na minusie”.
        let mut clock: solana_clock::Clock = svm.get_sysvar();
        clock.unix_timestamp = 1_790_000_000;
        svm.set_sysvar(&clock);
        let payer = Keypair::new();
        svm.airdrop(&payer.pubkey(), 100_000_000_000).unwrap();
        let mint = CreateMint::new(&mut svm, &payer).decimals(6).send().unwrap();
        let founder = new_firm(&mut svm, &payer, &mint);
        let creator = founder.key();
        let circle = pda(&[kwita::CIRCLE_SEED, creator.as_ref(), &CIRCLE_ID.to_le_bytes()]);
        let vault = pda(&[kwita::VAULT_SEED, circle.as_ref()]);
        let create = ix(
            kwita::instruction::CreateCircle {
                circle_id: CIRCLE_ID,
                deposit_amount: deposit,
                sales_limit_bps: bps,
                per_counterparty_cap: cap,
                max_sales_credit: max_sales,
                default_after_secs: default_after,
                max_positive_balance: max_positive,
            }
            .data(),
            kwita::accounts::CreateCircle {
                creator,
                circle,
                collateral_mint: mint,
                vault,
                token_program: anchor_spl::token::ID,
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        );
        let founder_kp = founder.kp.insecure_clone();
        send(&mut svm, &[create], &founder_kp, &[])?;
        Ok(Env { svm, payer, mint, circle, vault, creator, founder: Some(founder), joined: vec![] })
    }

    /// Nowa firma: SOL na opłaty, konto tPLN i 1 000 tPLN. Pierwsza to założyciel kręgu.
    pub fn firm(&mut self) -> Firm {
        if let Some(f) = self.founder.take() {
            return f;
        }
        new_firm(&mut self.svm, &self.payer, &self.mint)
    }

    /// Dołączenie jak w aplikacji: jeśli firma nie jest założycielem i nie ma zaproszenia,
    /// najpierw zaprasza ją pierwsza aktywna firma z kręgu.
    pub fn join(&mut self, f: &Firm) -> Result<(), FailedTransactionMetadata> {
        self.join_logs(f).map(|_| ())
    }

    pub fn join_logs(&mut self, f: &Firm) -> Result<Vec<String>, FailedTransactionMetadata> {
        if f.key() != self.creator && self.invite_opt(&f.key()).is_none() {
            let inviter = self
                .joined
                .iter()
                .find(|k| {
                    k.pubkey() != f.key()
                        && self
                            .member_opt(&k.pubkey())
                            .is_some_and(|m| m.status == kwita::MemberStatus::Active)
                })
                .map(|k| k.insecure_clone());
            if let Some(inviter) = inviter {
                self.invite_kp(&inviter, &f.key())?;
            }
        }
        self.join_only_logs(f)
    }

    /// Samo `join`: przekazuje zaproszenie, jeśli istnieje, bez zapraszania.
    pub fn join_only(&mut self, f: &Firm) -> Result<(), FailedTransactionMetadata> {
        self.join_only_logs(f).map(|_| ())
    }

    pub fn join_only_logs(&mut self, f: &Firm) -> Result<Vec<String>, FailedTransactionMetadata> {
        let invite = self.invite_opt(&f.key());
        let i = ix(
            kwita::instruction::Join {}.data(),
            kwita::accounts::Join {
                owner: f.key(),
                circle: self.circle,
                member: member_pda(&self.circle, &f.key()),
                collateral_mint: self.mint,
                owner_token: f.ata,
                vault: self.vault,
                invite: invite.as_ref().map(|_| invite_pda(&self.circle, &f.key())),
                inviter: invite.as_ref().map(|i| i.inviter),
                token_program: anchor_spl::token::ID,
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        );
        let kp = f.kp.insecure_clone();
        let res = send_logs(&mut self.svm, &[i], &kp, &[]);
        if res.is_ok() {
            self.joined.push(f.kp.insecure_clone());
        }
        res
    }

    pub fn invite(&mut self, inviter: &Firm, invitee: &Pubkey) -> Result<(), FailedTransactionMetadata> {
        self.invite_logs(inviter, invitee).map(|_| ())
    }

    pub fn invite_logs(&mut self, inviter: &Firm, invitee: &Pubkey) -> Result<Vec<String>, FailedTransactionMetadata> {
        let kp = inviter.kp.insecure_clone();
        self.invite_kp(&kp, invitee)
    }

    fn invite_kp(&mut self, inviter: &Keypair, invitee: &Pubkey) -> Result<Vec<String>, FailedTransactionMetadata> {
        let i = ix(
            kwita::instruction::Invite { invitee: *invitee }.data(),
            kwita::accounts::InviteFirm {
                inviter: inviter.pubkey(),
                circle: self.circle,
                inviter_member: member_pda(&self.circle, &inviter.pubkey()),
                invite: invite_pda(&self.circle, invitee),
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        );
        send_logs(&mut self.svm, &[i], inviter, &[])
    }

    pub fn revoke_invite(&mut self, inviter: &Firm, invitee: &Pubkey) -> Result<(), FailedTransactionMetadata> {
        let i = ix(
            kwita::instruction::RevokeInvite { invitee: *invitee }.data(),
            kwita::accounts::RevokeInvite {
                inviter: inviter.key(),
                circle: self.circle,
                invite: invite_pda(&self.circle, invitee),
            }
            .to_account_metas(None),
        );
        let kp = inviter.kp.insecure_clone();
        send(&mut self.svm, &[i], &kp, &[])
    }

    /// Zaproszenie dla firmy albo None (nie ma albo zużyte).
    pub fn invite_opt(&self, invitee: &Pubkey) -> Option<kwita::Invite> {
        let acc = self.svm.get_account(&invite_pda(&self.circle, invitee))?;
        if acc.lamports == 0 || acc.data.is_empty() {
            return None;
        }
        Some(kwita::Invite::try_deserialize(&mut acc.data.as_slice()).unwrap())
    }

    pub fn lamports(&self, key: &Pubkey) -> u64 {
        self.svm.get_account(key).map(|a| a.lamports).unwrap_or(0)
    }

    pub fn setup(n: usize) -> (Env, Vec<Firm>) {
        Self::setup_with(Env::new(), n)
    }

    pub fn setup_with(mut env: Env, n: usize) -> (Env, Vec<Firm>) {
        let firms: Vec<Firm> = (0..n).map(|_| env.firm()).collect();
        for f in &firms {
            env.join(f).unwrap();
        }
        (env, firms)
    }

    pub fn pay(&mut self, buyer: &Firm, seller: &Firm, amount: u64) -> Result<(), FailedTransactionMetadata> {
        self.pay_ref(buyer, seller, amount, "FV/1/2026")
    }

    pub fn pay_ref(
        &mut self,
        buyer: &Firm,
        seller: &Firm,
        amount: u64,
        invoice_ref: &str,
    ) -> Result<(), FailedTransactionMetadata> {
        self.pay_logs(buyer, seller, amount, invoice_ref).map(|_| ())
    }

    pub fn pay_logs(
        &mut self,
        buyer: &Firm,
        seller: &Firm,
        amount: u64,
        invoice_ref: &str,
    ) -> Result<Vec<String>, FailedTransactionMetadata> {
        let i = ix(
            kwita::instruction::Pay { amount, invoice_ref: invoice_ref.to_string() }.data(),
            kwita::accounts::Pay {
                buyer: buyer.key(),
                circle: self.circle,
                buyer_member: member_pda(&self.circle, &buyer.key()),
                seller_member: member_pda(&self.circle, &seller.key()),
                pair: pair_pda(&self.circle, &seller.key(), &buyer.key()),
                reverse_pair: pair_pda(&self.circle, &buyer.key(), &seller.key()),
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        );
        let kp = buyer.kp.insecure_clone();
        send_logs(&mut self.svm, &[i], &kp, &[])
    }

    pub fn give(&mut self, g: &Firm, b: &Firm, amount: u64) -> Result<(), FailedTransactionMetadata> {
        self.give_logs(g, b, amount).map(|_| ())
    }

    pub fn give_logs(&mut self, g: &Firm, b: &Firm, amount: u64) -> Result<Vec<String>, FailedTransactionMetadata> {
        let i = ix(
            kwita::instruction::GiveGuarantee { amount }.data(),
            kwita::accounts::GiveGuarantee {
                guarantor: g.key(),
                circle: self.circle,
                guarantor_member: member_pda(&self.circle, &g.key()),
                beneficiary_member: member_pda(&self.circle, &b.key()),
                guarantee: guarantee_pda(&self.circle, &g.key(), &b.key()),
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        );
        let kp = g.kp.insecure_clone();
        send_logs(&mut self.svm, &[i], &kp, &[])
    }

    pub fn withdraw(&mut self, g: &Firm, b: &Firm, amount: u64) -> Result<(), FailedTransactionMetadata> {
        let i = ix(
            kwita::instruction::WithdrawGuarantee { amount }.data(),
            kwita::accounts::WithdrawGuarantee {
                guarantor: g.key(),
                circle: self.circle,
                guarantor_member: member_pda(&self.circle, &g.key()),
                beneficiary_member: member_pda(&self.circle, &b.key()),
                guarantee: guarantee_pda(&self.circle, &g.key(), &b.key()),
            }
            .to_account_metas(None),
        );
        let kp = g.kp.insecure_clone();
        send(&mut self.svm, &[i], &kp, &[])
    }

    fn exit_accounts(&self, f: &Firm) -> Vec<anchor_lang::solana_program::instruction::AccountMeta> {
        kwita::accounts::Leave {
            owner: f.key(),
            circle: self.circle,
            member: member_pda(&self.circle, &f.key()),
            collateral_mint: self.mint,
            owner_token: f.ata,
            vault: self.vault,
            token_program: anchor_spl::token::ID,
        }
        .to_account_metas(None)
    }

    pub fn leave(&mut self, f: &Firm, forfeit_positive: bool) -> Result<(), FailedTransactionMetadata> {
        let i = ix(kwita::instruction::Leave { forfeit_positive }.data(), self.exit_accounts(f));
        let kp = f.kp.insecure_clone();
        send(&mut self.svm, &[i], &kp, &[])
    }

    pub fn redeem(&mut self, f: &Firm, amount: u64) -> Result<(), FailedTransactionMetadata> {
        // Redeem ma te same konta i kolejność co Leave
        let i = ix(kwita::instruction::Redeem { amount }.data(), self.exit_accounts(f));
        let kp = f.kp.insecure_clone();
        send(&mut self.svm, &[i], &kp, &[])
    }

    pub fn default_member(
        &mut self,
        caller: &Firm,
        target: &Firm,
        guarantors: &[&Firm],
    ) -> Result<(), FailedTransactionMetadata> {
        self.default_logs(caller, target, guarantors).map(|_| ())
    }

    pub fn default_logs(
        &mut self,
        caller: &Firm,
        target: &Firm,
        guarantors: &[&Firm],
    ) -> Result<Vec<String>, FailedTransactionMetadata> {
        use anchor_lang::solana_program::instruction::AccountMeta;
        let mut metas = kwita::accounts::DeclareDefault {
            caller: caller.key(),
            circle: self.circle,
            member: member_pda(&self.circle, &target.key()),
        }
        .to_account_metas(None);
        for g in guarantors {
            metas.push(AccountMeta::new(guarantee_pda(&self.circle, &g.key(), &target.key()), false));
            metas.push(AccountMeta::new(member_pda(&self.circle, &g.key()), false));
        }
        let i = ix(kwita::instruction::DeclareDefault {}.data(), metas);
        let kp = caller.kp.insecure_clone();
        send_logs(&mut self.svm, &[i], &kp, &[])
    }

    pub fn circle_state(&self) -> kwita::Circle {
        let acc = self.svm.get_account(&self.circle).unwrap();
        kwita::Circle::try_deserialize(&mut acc.data.as_slice()).unwrap()
    }

    /// Konto firmy albo None, jeśli zostało zamknięte (wyjście z kręgu).
    pub fn member_opt(&self, owner: &Pubkey) -> Option<kwita::Member> {
        let acc = self.svm.get_account(&member_pda(&self.circle, owner))?;
        if acc.lamports == 0 || acc.data.is_empty() {
            return None;
        }
        Some(kwita::Member::try_deserialize(&mut acc.data.as_slice()).unwrap())
    }

    pub fn member(&self, owner: &Pubkey) -> kwita::Member {
        let acc = self.svm.get_account(&member_pda(&self.circle, owner)).unwrap();
        kwita::Member::try_deserialize(&mut acc.data.as_slice()).unwrap()
    }

    pub fn guarantee(&self, guarantor: &Pubkey, beneficiary: &Pubkey) -> kwita::Guarantee {
        let acc = self
            .svm
            .get_account(&guarantee_pda(&self.circle, guarantor, beneficiary))
            .unwrap();
        kwita::Guarantee::try_deserialize(&mut acc.data.as_slice()).unwrap()
    }

    pub fn tokens(&self, ata: &Pubkey) -> u64 {
        let acc = self.svm.get_account(ata).unwrap();
        spl_token_interface::state::Account::unpack(&acc.data).unwrap().amount
    }

    pub fn warp(&mut self, secs: i64) {
        let mut clock: solana_clock::Clock = self.svm.get_sysvar();
        clock.unix_timestamp += secs;
        self.svm.set_sysvar(&clock);
    }

    /// Niezmienniki: suma sald + Rezerwa = 0; vault = kaucje + reserve_usdc.
    pub fn assert_invariants(&self, owners: &[Pubkey]) {
        let c = self.circle_state();
        let members: Vec<kwita::Member> = owners.iter().filter_map(|o| self.member_opt(o)).collect();
        let sum: i128 = members.iter().map(|m| m.balance as i128).sum::<i128>()
            + c.reserve_balance as i128;
        assert_eq!(sum, 0, "suma sald + Rezerwa != 0");
        let deposits: u64 = members.iter().map(|m| m.deposit).sum();
        assert_eq!(
            self.tokens(&self.vault),
            deposits + c.reserve_usdc,
            "vault != kaucje + reserve_usdc"
        );
    }
}
