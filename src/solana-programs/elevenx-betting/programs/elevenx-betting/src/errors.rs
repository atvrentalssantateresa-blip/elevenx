use anchor_lang::prelude::*;

#[error_code]
pub enum BettingError {
    #[msg("Betting window has closed for this market")]
    BettingClosed,

    #[msg("Market has already been settled")]
    AlreadySettled,

    #[msg("Market has been voided")]
    MarketVoided,

    #[msg("Stake amount must be greater than zero")]
    ZeroStake,

    #[msg("Invalid outcome index")]
    InvalidOutcome,

    #[msg("Too early to settle this market")]
    TooEarlyToSettle,

    #[msg("Market is paused")]
    MarketPaused,

    #[msg("Fee percentage exceeds maximum (5%)")]
    FeeTooHigh,

    #[msg("Invalid market timeline: openUntil must be before settleAfter")]
    InvalidTimeline,

    #[msg("Nothing to claim")]
    ClaimNothing,

    #[msg("Nothing to refund")]
    NothingToRefund,

    #[msg("Market is not voided — refund not available")]
    NotVoided,

    #[msg("Oracle has already voted for this market")]
    AlreadyVoted,

    #[msg("Insufficient oracle consensus")]
    InsufficientConsensus,

    #[msg("Outcome count must be 2 or 3")]
    InvalidOutcomeCount,

    #[msg("Market is already initialized")]
    AlreadyInitialized,

    #[msg("Arithmetic overflow")]
    Overflow,

    #[msg("Unauthorized")]
    Unauthorized,
}