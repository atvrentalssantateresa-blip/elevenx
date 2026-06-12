use anchor_lang::prelude::*;
use crate::state::{BetMarket, PlatformConfig, VoteTally, FeeVault};
use crate::errors::BettingError;

// ── CreateMarketParams ────────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateMarketParams {
    pub match_id: [u8; 32],
    pub outcome_names: [[u8; 32]; 3],
    pub open_until: i64,
    pub settle_after: i64,
    pub fee_percent_override: Option<u16>,
    pub outcome_count: u8,
    pub oracle_odds: [u64; 3],
}

// ── create_market ─────────────────────────────────────────────────────────────

pub fn create_market(ctx: Context<CreateMarket>, params: CreateMarketParams) -> Result<()> {
    require!(
        params.outcome_count == 2 || params.outcome_count == 3,
        BettingError::InvalidOutcomeCount
    );
    require!(params.open_until < params.settle_after, BettingError::InvalidTimeline);

    let clock = Clock::get()?;
    require!(params.open_until > clock.unix_timestamp, BettingError::BettingClosed);

    let platform = &ctx.accounts.platform_config;
    let fee_percent = if let Some(override_val) = params.fee_percent_override {
        require!(
            override_val <= PlatformConfig::MAX_FEE_PERCENT,
            BettingError::FeeTooHigh
        );
        override_val // Can be Some(0) to remove fees entirely
    } else {
        platform.fee_percent
    };

    let market = &mut ctx.accounts.market;
    market.match_id = params.match_id;
    market.outcome_names = params.outcome_names;
    market.open_until = params.open_until;
    market.settle_after = params.settle_after;
    market.fee_percent = fee_percent;
    market.outcome_count = params.outcome_count;
    market.winning_outcome = 0;
    market.oracle_odds = params.oracle_odds;
    market.total_matched = [0u64; 3];
    market.total_pending = [0u64; 3];
    market.total_lp_committed = 0;
    market.settlement_feed = Pubkey::default(); // Must be set by admin via set_settlement_feed
    market.accrued_fees = 0;
    market.settled = false;
    market.voided = false;
    market.paused = false;
    market.settlement_finalized = false;
    market.bump = ctx.bumps.market;

    let tally = &mut ctx.accounts.vote_tally;
    tally.market = market.key();
    tally.votes = [0u8; 3];
    tally.settled = false;
    tally.bump = ctx.bumps.vote_tally;

    Ok(())
}

// ── set_market_paused ─────────────────────────────────────────────────────────

pub fn set_market_paused(ctx: Context<SetMarketPaused>, paused: bool) -> Result<()> {
    ctx.accounts.market.paused = paused;
    Ok(())
}

// ── void_market ───────────────────────────────────────────────────────────────

pub fn void_market(ctx: Context<VoidMarket>) -> Result<()> {
    let market = &mut ctx.accounts.market;
    require!(!market.voided, BettingError::MarketVoided);
    require!(!market.settled, BettingError::AlreadySettled);
    market.voided = true;
    market.settled = true;
    Ok(())
}

// ── update_market_timestamps ──────────────────────────────────────────────────

pub fn update_market_timestamps(
    ctx: Context<UpdateMarketTimestamps>,
    open_until: i64,
    settle_after: i64,
) -> Result<()> {
    let market = &mut ctx.accounts.market;
    require!(open_until < settle_after, BettingError::InvalidTimeline);
    market.open_until = open_until;
    market.settle_after = settle_after;
    Ok(())
}

// ── close_market ──────────────────────────────────────────────────────────────
/// Admin-only: Close a dead market (e.g., oracle_odds=[0,0,0]) and free its PDA.
/// CRITICAL: Only use for markets that were never used (no bets, no liquidity).
/// This instruction does NOT transfer funds - use sweep_market_funds first if needed.
pub fn close_market(ctx: Context<CloseMarket>) -> Result<()> {
    let market = &mut ctx.accounts.market;
    
    // Safety checks: ensure market was never used
    require!(
        market.total_matched == [0u64; 3],
        BettingError::MarketAlreadyUsed
    );
    require!(
        market.total_pending == [0u64; 3],
        BettingError::MarketAlreadyUsed
    );
    require!(
        market.total_lp_committed == 0,
        BettingError::MarketAlreadyUsed
    );
    require!(
        market.accrued_fees == 0,
        BettingError::MarketAlreadyUsed
    );
    
    // Mark as closed (settled + voided) to prevent any future operations
    market.settled = true;
    market.voided = true;
    market.settlement_finalized = true;
    
    // Note: We don't actually free the PDA - Solana accounts can't be deleted
    // But marking as settled+voided prevents any further operations
    Ok(())
}

// ── set_settlement_feed ──────────────────────────────────────────────────────
/// Admin-only: Pin the Switchboard On-Demand feed pubkey to a market.
/// CRITICAL SECURITY: Must be set before settlement to prevent oracle
/// substitution attacks. Can only be set ONCE (cannot be swapped later).
pub fn set_settlement_feed(ctx: Context<SetSettlementFeed>, feed_pubkey: Pubkey) -> Result<()> {
    require!(feed_pubkey != Pubkey::default(), BettingError::InvalidOracleAccount);

    let market = &mut ctx.accounts.market;
    // Can only set once: a zero (default) feed means "not yet set".
    require!(
        market.settlement_feed == Pubkey::default(),
        BettingError::AlreadyInitialized
    );

    market.settlement_feed = feed_pubkey;

    msg!("[set_settlement_feed] Pinned feed {} to market", feed_pubkey);
    Ok(())
}

// ── close_market ──────────────────────────────────────────────────────────────
/// Admin-only: Close a dead market with oracle_odds=[0,0,0].
/// This marks the market as closed and voided, allowing LP withdrawals.
/// Used to recover from bad CLI script that created 64 dead markets.
/// 
/// REQUIREMENTS:
/// - Market must have oracle_odds = [0,0,0] (dead market)
/// - Market must have no matched bets (total_matched = [0,0,0])
/// - Market must have no pending bets (total_pending = [0,0,0])
/// - Market must have no LP committed (total_lp_committed = 0)
pub fn close_market(ctx: Context<CloseMarket>) -> Result<()> {
    let market = &mut ctx.accounts.market;
    
    // Only allow closing dead markets (odds = 0)
    require!(
        market.oracle_odds[0] == 0 && market.oracle_odds[1] == 0 && market.oracle_odds[2] == 0,
        BettingError::Unauthorized
    );
    
    // Ensure no funds are locked
    require!(
        market.total_matched[0] == 0 && market.total_matched[1] == 0 && market.total_matched[2] == 0,
        BettingError::Unauthorized
    );
    require!(
        market.total_pending[0] == 0 && market.total_pending[1] == 0 && market.total_pending[2] == 0,
        BettingError::Unauthorized
    );
    require!(market.total_lp_committed == 0, BettingError::Unauthorized);
    
    // Mark as voided and settled
    market.voided = true;
    market.settled = true;
    market.settlement_finalized = true;
    
    msg!("[close_market] Closed dead market {}", market.key());
    Ok(())
}

// ── sweep_market_funds ────────────────────────────────────────────────────────
/// Admin-only: Sweep residual SOL from a settled/voided market.
/// SECURITY FIX: 30-day grace period prevents sweeping unclaimed winnings.
///
/// NOTE: This is still a coarse safeguard. It assumes that after 30 days all
/// legitimate winners/LPs have claimed. It does NOT prove zero funds are owed.
/// A full fix would track outstanding obligations on the market and refuse to
/// sweep below them. Treat this as testnet-acceptable, NOT mainnet-final.
pub fn sweep_market_funds(ctx: Context<SweepMarketFunds>) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let clock = Clock::get()?;

    require!(market.settled || market.voided, BettingError::TooEarlyToSettle);

    const SWEEP_GRACE_SECONDS: i64 = 60 * 60 * 24 * 30; // 30 days
    require!(
        clock.unix_timestamp >= market.settle_after.saturating_add(SWEEP_GRACE_SECONDS),
        BettingError::TooEarlyToSettle
    );

    let market_balance = **market.to_account_info().try_borrow_lamports()?;
    let rent_exempt = Rent::get()?.minimum_balance(market.to_account_info().data_len());
    let sweep_amount = market_balance.saturating_sub(rent_exempt);

    require!(sweep_amount > 0, BettingError::ClaimNothing);

    **market.to_account_info().try_borrow_mut_lamports()? -= sweep_amount;
    **ctx.accounts.admin_destination.try_borrow_mut_lamports()? += sweep_amount;

    msg!("[sweep_market_funds] Swept {} lamports from market to admin wallet", sweep_amount);
    Ok(())
}

// ── Accounts ──────────────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(params: CreateMarketParams)]
pub struct CreateMarket<'info> {
    #[account(
        init,
        payer = admin,
        space = BetMarket::LEN,
        seeds = [b"market", params.match_id.as_ref()],
        bump
    )]
    pub market: Account<'info, BetMarket>,
    #[account(
        init,
        payer = admin,
        space = VoteTally::LEN,
        seeds = [b"vote_tally", market.key().as_ref()],
        bump
    )]
    pub vote_tally: Account<'info, VoteTally>,
    #[account(
        mut,
        seeds = [b"platform"],
        bump
    )]
    pub platform_config: Account<'info, PlatformConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetMarketPaused<'info> {
    #[account(mut, seeds = [b"market", market.match_id.as_ref()], bump = market.bump)]
    pub market: Account<'info, BetMarket>,

    #[account(seeds = [b"platform"], bump = platform_config.bump)]
    pub platform_config: Account<'info, PlatformConfig>,

    #[account(constraint = admin.key() == platform_config.admin @ BettingError::Unauthorized)]
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct VoidMarket<'info> {
    #[account(mut, seeds = [b"market", market.match_id.as_ref()], bump = market.bump)]
    pub market: Account<'info, BetMarket>,

    #[account(seeds = [b"platform"], bump = platform_config.bump)]
    pub platform_config: Account<'info, PlatformConfig>,

    #[account(constraint = admin.key() == platform_config.admin @ BettingError::Unauthorized)]
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateMarketTimestamps<'info> {
    #[account(mut, seeds = [b"market", market.match_id.as_ref()], bump = market.bump)]
    pub market: Account<'info, BetMarket>,

    #[account(seeds = [b"platform"], bump = platform_config.bump)]
    pub platform_config: Account<'info, PlatformConfig>,

    #[account(constraint = admin.key() == platform_config.admin @ BettingError::Unauthorized)]
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetSettlementFeed<'info> {
    #[account(
        mut,
        seeds = [b"market", market.match_id.as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, BetMarket>,

    #[account(seeds = [b"platform"], bump = platform_config.bump)]
    pub platform_config: Account<'info, PlatformConfig>,

    #[account(constraint = admin.key() == platform_config.admin @ BettingError::Unauthorized)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseMarket<'info> {
    #[account(
        mut,
        seeds = [b"market", market.match_id.as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, BetMarket>,

    #[account(seeds = [b"platform"], bump = platform_config.bump)]
    pub platform_config: Account<'info, PlatformConfig>,

    #[account(constraint = admin.key() == platform_config.admin @ BettingError::Unauthorized)]
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct SweepMarketFunds<'info> {
    #[account(
        mut,
        seeds = [b"market", market.match_id.as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, BetMarket>,

    #[account(seeds = [b"platform"], bump = platform_config.bump)]
    pub platform_config: Account<'info, PlatformConfig>,

    #[account(mut, constraint = admin.key() == platform_config.admin @ BettingError::Unauthorized)]
    pub admin: Signer<'info>,

    /// CHECK: Recipient of the swept funds (admin wallet)
    #[account(mut)]
    pub admin_destination: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}