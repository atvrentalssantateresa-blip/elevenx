use anchor_lang::prelude::*;

/// Per-match betting market.
/// PDA seeds: ["market", match_id (32 bytes)]
#[account]
pub struct BetMarket {
    /// Unique match identifier (e.g., keccak of "FIFA-2026-MXZAF").
    pub match_id: [u8; 32],

    /// Team / outcome names. Index 0 = Home/TeamA, 1 = Away/TeamB, 2 = Draw.
    pub outcome_names: [[u8; 32]; 3],

    /// UNIX timestamp after which no more bets are accepted.
    pub open_until: i64,

    /// UNIX timestamp before which settlement cannot be triggered.
    pub settle_after: i64,

    /// Fee in basis points (200 = 2%).
    pub fee_percent: u16,

    /// 2 for binary markets (tennis/basketball), 3 for football (adds Draw).
    pub outcome_count: u8,

    /// Filled in after settlement.
    pub winning_outcome: u8,

    // ── Hybrid fixed-odds LP model ────────────────────────────────────────────

    /// Oracle-provided fixed odds for each outcome in basis points (odds * 100).
    /// e.g. 210 = 2.10x.  Set at market creation and can be updated by admin
    /// before betting opens.
    pub oracle_odds: [u64; 3],

    /// Total bettor stakes that have been matched (backed by LP liquidity).
    pub total_matched: [u64; 3],

    /// Total bettor stakes that are pending (waiting for LP liquidity).
    pub total_pending: [u64; 3],

    /// Total LP liquidity locked in this market.
    pub total_lp_committed: u64,

    // ── Legacy / settlement fields ─────────────────────────────────────────────

    /// Fees accrued during settlement (transferred to fee vault on finalize).
    pub accrued_fees: u64,

    pub settled: bool,
    pub voided: bool,
    pub paused: bool,
    pub settlement_finalized: bool,

    pub bump: u8,
}

impl BetMarket {
    pub const LEN: usize = 8     // discriminator
        + 32   // match_id
        + 96   // outcome_names (3 × 32)
        + 8    // open_until
        + 8    // settle_after
        + 2    // fee_percent
        + 1    // outcome_count
        + 1    // winning_outcome
        + 24   // oracle_odds (3 × 8)
        + 24   // total_matched (3 × 8)
        + 24   // total_pending (3 × 8)
        + 8    // total_lp_committed
        + 8    // accrued_fees
        + 1    // settled
        + 1    // voided
        + 1    // paused
        + 1    // settlement_finalized
        + 1;   // bump
}