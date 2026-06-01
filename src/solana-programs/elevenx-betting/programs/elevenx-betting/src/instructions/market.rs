use anchor_lang::prelude::*;
use crate::state::{BetMarket, PlatformConfig, VoteTally};
use crate::errors::BettingError;

// ── Params ───────────────────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateMarketParams {
    pub match_id: [u8; 32],
    /// UTF-8 outcome names, padded to 32 bytes.
    pub outcome_names: [[u8; 32]; 3],
    pub open_until: i64,
    pub settle_after: i64,
    /// Override fee percent (0 = use platform default).
    pub fee_percent_override: u16,
    /// 2 = binary, 3 = football (adds Draw).
    pub outcome_count: u8,
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
    let fee_percent = if params.fee_percent_override > 0 {
        require!(
            params.fee_percent_override <= PlatformConfig::MAX_FEE_PERCENT,
            BettingError::FeeTooHigh
        );
        params.fee_percent_override
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
    market.total_by_outcome = [0u64; 3];
    market.total_all = 0;
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

// ── Accounts ──────────────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(params: CreateMarketParams)]
pub struct CreateMarket<'info> {
    #[account(
        init,
        payer = admin,
        space = BetMarket::LEN,
        seeds = [b"market", &params.match_id],
        bump,
    )]
    pub market: Account<'info, BetMarket>,

    #[account(
        init,
        payer = admin,
        space = VoteTally::LEN,
        seeds = [b"vote_tally", market.key().as_ref()],
        bump,
    )]
    pub vote_tally: Account<'info, VoteTally>,

    #[account(seeds = [b"platform"], bump = platform_config.bump)]
    pub platform_config: Account<'info, PlatformConfig>,

    #[account(mut, constraint = admin.key() == platform_config.admin @ BettingError::Unauthorized)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetMarketPaused<'info> {
    #[account(mut, seeds = [b"market", &market.match_id], bump = market.bump)]
    pub market: Account<'info, BetMarket>,

    #[account(seeds = [b"platform"], bump = platform_config.bump)]
    pub platform_config: Account<'info, PlatformConfig>,

    #[account(constraint = admin.key() == platform_config.admin @ BettingError::Unauthorized)]
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct VoidMarket<'info> {
    #[account(mut, seeds = [b"market", &market.match_id], bump = market.bump)]
    pub market: Account<'info, BetMarket>,

    #[account(seeds = [b"platform"], bump = platform_config.bump)]
    pub platform_config: Account<'info, PlatformConfig>,

    #[account(constraint = admin.key() == platform_config.admin @ BettingError::Unauthorized)]
    pub admin: Signer<'info>,
}