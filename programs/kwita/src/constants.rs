use anchor_lang::prelude::*;

#[constant]
pub const CIRCLE_SEED: &[u8] = b"circle";
#[constant]
pub const VAULT_SEED: &[u8] = b"vault";
#[constant]
pub const MEMBER_SEED: &[u8] = b"member";
#[constant]
pub const PAIR_SEED: &[u8] = b"pair";
#[constant]
pub const GUARANTEE_SEED: &[u8] = b"guarantee";
#[constant]
pub const INVITE_SEED: &[u8] = b"invite";

pub const MAX_INVOICE_REF_LEN: usize = 64;
pub const BPS_DENOMINATOR: u128 = 10_000;
