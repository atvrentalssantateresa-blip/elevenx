use anchor_lang::prelude::*;
use crate::state::{BetMarket, PlatformConfig, OracleVote, VoteTally, FeeVault};
use crate::errors::BettingError;

// ── Shared settlement logic ───────────────────────────────────────────────────

fn execute_settlement(market: &mut BetMarket, fee_vault: &mut FeeVault, winning_outcome: u8) -> Result<()> {
    market.settled = true;
    market.winning_outcome = winning_outcome;
    market.settlement_finalized = true;

    let winners_pool = market.total_by_outcome[winning_outcome as usize];

    // If nobody backed the winning outcome, void the market instead.
    if winners_pool == 0 {
        market.voided = true;
        return Ok(());
    }

    let losers_pool = market.total_all.saturating_sub(winners_pool);

    // Compute per-market accrued fees (will be collected when winners claim).
    // We store total fees and track them in accrued_fees for accounting.
    // Actual fee transfer happens at claim time — we deduct fee from each winner's payout.
    let fee_percent = market.fee_percent as u64;

    // Rough total fee estimate = fee_percent * losers_pool / 10_000
    // (exact per-winner fee computed at claim time)
    let estimated_fees = losers_pool
        .checked_mul(fee_percent)
        .and_then(|v| v.checked_div(10_000))
        .unwrap_or(0);

    market.accrued_fees = estimated_fees;
    fee_vault.total_fees = fee_vault.total_fees.saturating_add(estimated_fees);

    Ok(())
}

// ── submit_oracle_vote ────────────────────────────────────────────────────────

pub fn submit_oracle_vote(ctx: Context<SubmitOracleVote>, winning_outcome: u8) -> Result<()> {
    let clock = Clock::get()?;
    let market = &ctx.accounts.market;

    require!(!market.settled && !market.voided, BettingError::AlreadySettled);
    require!(clock.unix_timestamp >= market.settle_after, BettingError::TooEarlyToSettle);
    require!(winning_outcome < market.outcome_count, BettingError::InvalidOutcome);

    // Record this oracle's vote.
    let vote = &mut ctx.accounts.oracle_vote;
    require!(!vote.has_voted, BettingError::AlreadyVoted);
    vote.market = market.key();
    vote.oracle = ctx.accounts.oracle.key();
    vote.voted_outcome = winning_outcome;
    vote.has_voted = true;
    vote.bump = ctx.bumps.oracle_vote;

    // Update tally.
    let tally = &mut ctx.accounts.vote_tally;
    tally.votes[winning_outcome as usize] = tally.votes[winning_outcome as usize].saturating_add(1);

    let platform = &ctx.accounts.platform_config;
    let vote_count = tally.votes[winning_outcome as usize];

    // Fire settlement when consensus threshold is reached.
    if vote_count >= platform.consensus_threshold && !tally.settled {
        tally.settled = true;
        let market_mut = &mut ctx.accounts.market;
        let fee_vault = &mut ctx.accounts.fee_vault;
        execute_settlement(market_mut, fee_vault, winning_outcome)?;
    }

    Ok(())
}

// ── emergency_settle ──────────────────────────────────────────────────────────

pub fn emergency_settle(ctx: Context<EmergencySettle>, winning_outcome: u8) -> Result<()> {
    let clock = Clock::get()?;
    let market = &ctx.accounts.market;

    require!(!market.settled && !market.voided, BettingError::AlreadySettled);
    require!(clock.unix_timestamp >= market.settle_after, BettingError::TooEarlyToSettle);
    require!(winning_outcome < market.outcome_count, BettingError::InvalidOutcome);

    let market_mut = &mut ctx.accounts.market;
    let fee_vault = &mut ctx.accounts.fee_vault;
    execute_settlement(market_mut, fee_vault, winning_outcome)?;

    Ok(())
}

// ── Accounts ──────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct SubmitOracleVote<'info> {
    #[account(
        mut,
        seeds = [b"market", &market.match_id],
        bump = market.bump,
    )]
    pub market: Account<'info, BetMarket>,

    #[account(
        init_if_needed,
        payer = oracle,
        space = OracleVote::LEN,
        seeds = [b"oracle_vote", market.key().as_ref(), oracle.key().as_ref()],
        bump,
    )]
    pub oracle_vote: Account<'info, OracleVote>,

    #[account(
        mut,
        seeds = [b"vote_tally", market.key().as_ref()],
        bump = vote_tally.bump,
    )]
    pub vote_tally: Account<'info, VoteTally>,

    #[account(seeds = [b"platform"], bump = platform_config.bump)]
    pub platform_config: Account<'info, PlatformConfig>,

    #[account(mut, seeds = [b"fee_vault"], bump = fee_vault.bump)]
    pub fee_vault: Account<'info, FeeVault>,

    #[account(mut)]
    pub oracle: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct EmergencySettle<'info> {
    #[account(
        mut,
        seeds = [b"market", &market.match_id],
        bump = market.bump,
    )]
    pub market: Account<'info, BetMarket>,

    #[account(seeds = [b"platform"], bump = platform_config.bump)]
    pub platform_config: Account<'info, PlatformConfig>,

    #[account(mut, seeds = [b"fee_vault"], bump = fee_vault.bump)]
    pub fee_vault: Account<'info, FeeVault>,

    #[account(mut, constraint = admin.key() == platform_config.admin @ BettingError::Unauthorized)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}