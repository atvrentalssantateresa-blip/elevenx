use anchor_lang::prelude::*;

/// Tracks a single bettor's stake and payout in a market.
/// PDA seeds: ["position", market_pubkey, bettor_pubkey]
#[account]
#[derive(Default)]
pub struct BetPosition {
    pub market: Pubkey,
    pub bettor: Pubkey,

    /// Which outcome (0, 1, 2) this position is on.
    pub outcome: u8,

    /// Lamports that have been matched against LP liquidity (locked in).
    pub matched_stake: u64,

    /// Lamports that are waiting for LP coverage (not yet locked).
    pub pending_stake: u64,

    /// Fixed odds (in bps) at the time the bet was placed. e.g. 210 = 2.10x.
    pub odds_bps: u64,

    /// Pre-computed payout if bettor wins: matched_stake * odds_bps / 100.
    /// This is the gross amount the bettor receives (before fee deduction at claim time).
    pub potential_payout: u64,

    /// Actual payout after settlement and fee deduction.
    pub claimable: u64,

    /// True once claim() or refund() has been called.
    pub claimed: bool,

    pub bump: u8,
}

impl BetPosition {
    pub const LEN: usize = 8   // discriminator
        + 32  // market
        + 32  // bettor
        + 1   // outcome
        + 8   // matched_stake
        + 8   // pending_stake
        + 8   // odds_bps
        + 8   // potential_payout
        + 8   // claimable
        + 1   // claimed
        + 1;  // bump
}