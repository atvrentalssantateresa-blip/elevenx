use anchor_lang::prelude::*;

/// Records a single oracle signer's vote for a market.
/// PDA seeds: ["oracle_vote", market_pubkey, oracle_pubkey]
#[account]
#[derive(Default)]
pub struct OracleVote {
    pub market: Pubkey,
    pub oracle: Pubkey,
    pub voted_outcome: u8,
    pub has_voted: bool,
    pub bump: u8,
}

impl OracleVote {
    pub const LEN: usize = 8  // discriminator
        + 32  // market
        + 32  // oracle
        + 1   // voted_outcome
        + 1   // has_voted
        + 1;  // bump
}

/// Tracks aggregate vote counts per outcome per market.
/// PDA seeds: ["vote_tally", market_pubkey]
#[account]
#[derive(Default)]
pub struct VoteTally {
    pub market: Pubkey,
    /// votes[0..3] — count of oracle votes per outcome.
    pub votes: [u8; 3],
    pub settled: bool,
    pub bump: u8,
}

impl VoteTally {
    pub const LEN: usize = 8  // discriminator
        + 32  // market
        + 3   // votes
        + 1   // settled
        + 1;  // bump
}