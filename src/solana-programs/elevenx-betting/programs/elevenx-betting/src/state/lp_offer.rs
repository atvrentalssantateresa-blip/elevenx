use anchor_lang::prelude::*;

/// An LP's fixed-odds liquidity offer for a specific outcome in a market.
/// PDA seeds: ["lp_offer", market_pubkey, lp_pubkey, outcome (1 byte)]
///
/// The LP commits SOL to cover bettors who pick the OPPOSITE outcome.
/// e.g. LP offers on outcome 0 (TeamA wins) — meaning they will PAY bettors
/// who bet on TeamA if TeamA wins, and COLLECT their stake if TeamA loses.
#[account]
pub struct LpOffer {
    pub market: Pubkey,
    pub lp: Pubkey,

    /// Which outcome (0, 1, 2) this LP is backing / covering.
    pub outcome: u8,

    /// Oracle-fixed odds in basis points. e.g. 210 = 2.10x (implied 47.6% win prob).
    /// Stored as integer: actual_odds * 100. Min 101 (1.01x), Max 10000 (100x).
    pub odds_bps: u64,

    /// Total SOL (lamports) the LP deposited to cover bets.
    pub amount_committed: u64,

    /// How much of that commitment has already been matched to bettor stakes.
    pub amount_matched: u64,

    /// True once all committed liquidity is matched or LP withdrew remainder.
    pub closed: bool,

    /// For settled markets: the matched stake that was used (for winning calculations)
    pub matched_stake: u64,

    /// True if LP has withdrawn winnings from a settled market
    pub withdrawn: bool,

    pub bump: u8,
}

impl LpOffer {
    pub const LEN: usize = 8   // discriminator
        + 32  // market
        + 32  // lp
        + 1   // outcome
        + 8   // odds_bps
        + 8   // amount_committed
        + 8   // amount_matched
        + 1   // closed
        + 8   // matched_stake
        + 1   // withdrawn
        + 1;  // bump

    /// Remaining unmatched liquidity.
    pub fn available(&self) -> u64 {
        self.amount_committed.saturating_sub(self.amount_matched)
    }
}