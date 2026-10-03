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

pub fn guarantee_pda(circle: &Pubkey, guarantor: &Pubkey, beneficiary: &Pubkey) -> Pubkey {
    pda(&[kwita::GUARANTEE_SEED, circle.as_ref(), guarantor.as_ref(), beneficiary.as_ref()])
}

pub fn send(
    svm: &mut LiteSVM,
    ixs: &[Instruction],
    payer: &Keypair,
    signers: &[&Keypair],
) -> Result<(), FailedTransactionMetadata> {
    svm.expire_blockhash();
    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(ixs, Some(&payer.pubkey()), &blockhash);
    let mut all: Vec<&Keypair> = vec![payer];
    all.extend_from_slice(signers);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &all).unwrap();
    svm.send_transaction(tx).map(|_| ())
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
        let circle = pda(&[kwita::CIRCLE_SEED, payer.pubkey().as_ref(), &CIRCLE_ID.to_le_bytes()]);
        let vault = pda(&[kwita::VAULT_SEED, circle.as_ref()]);
        let create = ix(
            kwita::instruction::CreateCircle {
                circle_id: CIRCLE_ID,
                deposit_amount: deposit,
                sales_limit_bps: bps,
                per_counterparty_cap: cap,
                max_sales_credit: max_sales,
                default_after_secs: default_after,
            }
            .data(),
            kwita::accounts::CreateCircle {
                creator: payer.pubkey(),
                circle,
                collateral_mint: mint,
                vault,
                token_program: anchor_spl::token::ID,
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        );
        let mut env = Env { svm, payer, mint, circle, vault };
        let payer_kp = env.payer.insecure_clone();
        send(&mut env.svm, &[create], &payer_kp, &[])?;
        Ok(env)
    }

    /// Nowa firma: SOL na opłaty, konto tPLN i 1 000 tPLN.
    pub fn firm(&mut self) -> Firm {
        let kp = Keypair::new();
        self.svm.airdrop(&kp.pubkey(), 10_000_000_000).unwrap();
        let ata = CreateAssociatedTokenAccount::new(&mut self.svm, &self.payer, &self.mint)
            .owner(&kp.pubkey())
            .send()
            .unwrap();
        MintTo::new(&mut self.svm, &self.payer, &self.mint, &ata, 1_000 * UNIT)
            .send()
            .unwrap();
        Firm { kp, ata }
    }

    pub fn join(&mut self, f: &Firm) -> Result<(), FailedTransactionMetadata> {
        let i = ix(
            kwita::instruction::Join {}.data(),
            kwita::accounts::Join {
                owner: f.key(),
                circle: self.circle,
                member: member_pda(&self.circle, &f.key()),
                collateral_mint: self.mint,
                owner_token: f.ata,
                vault: self.vault,
                token_program: anchor_spl::token::ID,
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        );
        let kp = f.kp.insecure_clone();
        send(&mut self.svm, &[i], &kp, &[])
    }

    pub fn setup(n: usize) -> (Env, Vec<Firm>) {
        let mut env = Env::new();
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
        let i = ix(
            kwita::instruction::Pay { amount, invoice_ref: invoice_ref.to_string() }.data(),
            kwita::accounts::Pay {
                buyer: buyer.key(),
                circle: self.circle,
                buyer_member: member_pda(&self.circle, &buyer.key()),
                seller_member: member_pda(&self.circle, &seller.key()),
                pair: pair_pda(&self.circle, &seller.key(), &buyer.key()),
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        );
        let kp = buyer.kp.insecure_clone();
        send(&mut self.svm, &[i], &kp, &[])
    }

    pub fn give(&mut self, g: &Firm, b: &Firm, amount: u64) -> Result<(), FailedTransactionMetadata> {
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
        send(&mut self.svm, &[i], &kp, &[])
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

    pub fn circle_state(&self) -> kwita::Circle {
        let acc = self.svm.get_account(&self.circle).unwrap();
        kwita::Circle::try_deserialize(&mut acc.data.as_slice()).unwrap()
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
        let members: Vec<kwita::Member> = owners.iter().map(|o| self.member(o)).collect();
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
