use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::{BetMarket, BetPosition, LpOffer};
use crate::errors::BettingError;

// ── place_bet ─────────────────────────────────────────────────────────────────
//
// Hybrid fixed-odds model:
//   1. Bettor picks an outcome and stakes SOL.
//   2. We read oracle_odds from the market for that outcome.
//   3. We try to match the bettor's stake against the LP offer for that outcome.
//      - "Matching" means: the LP has committed SOL to cover this outcome,
//        so if the bettor wins, we pay them from the LP's committed pool.
//   4. Any portion that cannot be matched immediately enters pending state.
//   5. potential_payout = matched_stake * odds_bps / 100.

pub fn place_bet(ctx: Context<PlaceBet>, outcome: u8, amount: u64) -> Result<()> {
    let clock = Clock::get()?;

    // Read-only checks before mutating.
    {
        let market = &ctx.accounts.market;
        require!(!market.paused, BettingError::MarketPaused);
        require!(!market.settled && !market.voided, BettingError::AlreadySettled);
        require!(clock.unix_timestamp < market.open_until, BettingError::BettingClosed);
        require!(outcome < market.outcome_count, BettingError::InvalidOutcome);
        require!(amount > 0, BettingError::ZeroStake);
        let odds_bps = market.oracle_odds[outcome as usize];
        require!(odds_bps > 100, BettingError::InvalidOutcome);
    }

    let odds_bps = ctx.accounts.market.oracle_odds[outcome as usize];

    // ── HYBRID MODEL: ENFORCE LP-FIRST RULE ──────────────────────────────────
    // Bettor stake CANNOT exceed available LP pool (guaranteed solvency)
    let available_liquidity = {
        let offer = &ctx.accounts.lp_offer;
        offer.available()
    };
    
    require!(
        available_liquidity > 0,
        BettingError::NoLiquidity
    );
    require!(
        amount <= available_liquidity,
        BettingError::StakeExceedsLiquidity
    );

    // Transfer SOL from bettor to market escrow.
    let cpi_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        system_program::Transfer {
            from: ctx.accounts.bettor.to_account_info(),
            to: ctx.accounts.market.to_account_info(),
        },
    );
    system_program::transfer(cpi_ctx, amount)?;

    let market = &mut ctx.accounts.market;

    // ── Match against LP offer (FULLY MATCHED ONLY) ───────────────────────────
    //
    // In hybrid model: bettor stake is ALWAYS fully matched against LP pool.
    // No pending state - the LP-first rule ensures full backing.

    let matched_now = {
        let offer = &mut ctx.accounts.lp_offer;
        
        // This should never fail due to pre-checks, but guard anyway
        let available = offer.available();
        let matched = available.min(amount);

        offer.amount_matched = offer
            .amount_matched
            .checked_add(matched)
            .ok_or(BettingError::Overflow)?;

        matched
    };

    // Update market tracking.
    market.total_matched[outcome as usize] = market.total_matched[outcome as usize]
        .checked_add(matched_now)
        .ok_or(BettingError::Overflow)?;
    market.total_pending[outcome as usize] = market.total_pending[outcome as usize]
        .checked_add(pending_now)
        .ok_or(BettingError::Overflow)?;

    // potential_payout = matched_stake * odds_bps / 100
    // e.g. 1 SOL at odds 2.10 (210 bps) → 2.10 SOL gross payout.
    let potential_payout = (matched_now as u128)
        .checked_mul(odds_bps as u128)
        .and_then(|v| v.checked_div(100))
        .unwrap_or(0) as u64;

    // ── Initialize / update BetPosition ──────────────────────────────────────
    let position = &mut ctx.accounts.bet_position;
    if position.market == Pubkey::default() {
        position.market = market.key();
        position.bettor = ctx.accounts.bettor.key();
        position.outcome = outcome;
        position.matched_stake = 0;
        position.pending_stake = 0;
        position.odds_bps = odds_bps;
        position.potential_payout = 0;
        position.claimable = 0;
        position.claimed = false;
        position.bump = ctx.bumps.bet_position;
    }

    position.matched_stake = position
        .matched_stake
        .checked_add(matched_now)
        .ok_or(BettingError::Overflow)?;
    position.pending_stake = position
        .pending_stake
        .checked_add(pending_now)
        .ok_or(BettingError::Overflow)?;
    position.potential_payout = position
        .potential_payout
        .checked_add(potential_payout)
        .ok_or(BettingError::Overflow)?;

    Ok(())
}

// ── Accounts ──────────────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(outcome: u8, amount: u64)]
pub struct PlaceBet<'info> {
    #[account(
        mut,
        seeds = [b"market", market.match_id.as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, BetMarket>,

    /// The LP offer for this outcome — bettor's stake matches against this pool.
    #[account(
        mut,
        seeds = [b"lp_offer", market.key().as_ref(), lp_offer.lp.as_ref(), &[outcome]],
        bump = lp_offer.bump,
    )]
    pub lp_offer: Account<'info, LpOffer>,

    #[account(
        init_if_needed,
        payer = bettor,
        space = BetPosition::LEN,
        seeds = [b"position", market.key().as_ref(), bettor.key().as_ref()],
        bump,
    )]
    pub bet_position: Account<'info, BetPosition>,

    #[account(mut)]
    pub bettor: Signer<'info>,

    pub system_program: Program<'info, System>,
}