use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

use crate::{constants::CIRCLE_SEED, state::Circle};

/// Przelew z vault kręgu; podpisuje PDA `Circle`.
pub fn transfer_from_vault<'info>(
    circle: &Account<'info, Circle>,
    vault: &Account<'info, TokenAccount>,
    mint: &Account<'info, Mint>,
    to: &Account<'info, TokenAccount>,
    token_program: &Program<'info, Token>,
    amount: u64,
) -> Result<()> {
    let id = circle.circle_id.to_le_bytes();
    let seeds: &[&[u8]] = &[CIRCLE_SEED, circle.creator.as_ref(), &id, &[circle.bump]];
    let signer = &[seeds];
    token::transfer_checked(
        CpiContext::new_with_signer(
            token_program.key(),
            TransferChecked {
                from: vault.to_account_info(),
                mint: mint.to_account_info(),
                to: to.to_account_info(),
                authority: circle.to_account_info(),
            },
            signer,
        ),
        amount,
        mint.decimals,
    )
}
