use anchor_lang::prelude::*;

/// Tracks a single bettor's stake and payout in a market.
/// PDA seeds: ["position", market_pubkey, bettor_pubkey]
#[account]
#[derive(Default)]
pub struct BetPosition {
    pub market: Pubkey,
    pub bettor: Pubkey,

    /// Lamports staked per outcome (index 0-2).
    pub stakes: [u64; 3],

    /// Pre-computed payout set during settlement. 0 = not yet settled or lost.
    pub claimable: u64,

    /// True once claim() or refund() has been called.
    pub claimed: bool,

    pub bump: u8,
}

impl BetPosition {
    pub const LEN: usize = 8   // discriminator
        + 32  // market
        + 32  // bettor
        + 24  // stakes (3 × 8)
        + 8   // claimable
        + 1   // claimed
        + 1;  // bump
}