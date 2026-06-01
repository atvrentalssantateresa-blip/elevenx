use anchor_lang::prelude::*;

/// Fee vault — collects platform fees from settled markets.
/// PDA seeds: ["fee_vault"]
/// The vault itself is a PDA that holds SOL (lamports).
/// Equivalent to Solidity FeeVault.sol — but simplified:
/// because Solana uses native SOL (no ERC-20), we just track
/// lamports accumulated and let the admin withdraw via system transfer.
#[account]
#[derive(Default)]
pub struct FeeVault {
    pub admin: Pubkey,
    pub total_fees: u64,
    pub bump: u8,
}

impl FeeVault {
    pub const LEN: usize = 8  // discriminator
        + 32  // admin
        + 8   // total_fees
        + 1;  // bump
}