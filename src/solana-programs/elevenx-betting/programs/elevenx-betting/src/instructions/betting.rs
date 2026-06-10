use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::{BetMarket, BetPosition, LpOffer};
use crate::errors::BettingError;

// ── place_bet ─────────────────────────────────────────────────────────────────
//
// Liability-based fixed-odds model:
//   1. Bettor picks an outcome and stakes SOL.
//   2. We read oracle_odds from the market for that outcome.
//   3. We match the bettor's stake against the LP offer for that outcome.
//   4. LP liability = stake * (odds - 1) — this is what gets locked in amount_matched.
//   5. potential_payout = stake * odds_bps / 100.

pub fn place_bet(ctx: Context<PlaceBet>, outcome: u8, amount: u64) -> Result<()> {
    let clock = Clock::get()?;

    // ── Validation ───────────────────────────────────────────────────────────
    {
        let market = &ctx.accounts.market;
        require!(!market.paused, BettingError::MarketPaused);
        require!(!market.settled && !market.voided, BettingError::AlreadySettled);
        require!(clock.unix_timestamp < market.open_until, BettingError::BettingClosed);
        require!(outcome < market.outcome_count, BettingError::InvalidOutcome);
        require!(amount > 0, BettingError::ZeroStake);
    }

    let odds_pct = ctx.accounts.market.oracle_odds[outcome as usize];
    require!(odds_pct > 100, BettingError::InvalidOutcome); // must be > 1.0x

    // ── LP LIABILITY (not stake) is what must be reserved ─────────────────────
    // liability = stake * (odds - 1)  =  stake * (odds_pct - 100) / 100
    let liability = (amount as u128)
        .checked_mul((odds_pct as u128).checked_sub(100).ok_or(BettingError::Overflow)?)
        .and_then(|v| v.checked_div(100))
        .ok_or(BettingError::Overflow)? as u64;

    require!(liability > 0, BettingError::ZeroStake);

    let available_liquidity = ctx.accounts.lp_offer.available();
    require!(available_liquidity > 0, BettingError::NoLiquidity);
    require!(liability <= available_liquidity, BettingError::StakeExceedsLiquidity);

    // ── Move bettor stake into escrow (LP funds already deposited earlier) ─────
    let cpi_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        system_program::Transfer {
            from: ctx.accounts.bettor.to_account_info(),
            to: ctx.accounts.market.to_account_info(),
        },
    );
    system_program::transfer(cpi_ctx, amount)?;

    let market = &mut ctx.accounts.market;

    // ── Reserve LP liability + record bettor stake separately ─────────────────
    {
        let offer = &mut ctx.accounts.lp_offer;

        // amount_matched tracks LIABILITY locked (so available() shrinks correctly)
        offer.amount_matched = offer
            .amount_matched
            .checked_add(liability)
            .ok_or(BettingError::Overflow)?;

        // matched_stake tracks the bettor stake the LP wins if the bettor loses
        offer.matched_stake = offer
            .matched_stake
            .checked_add(amount)
            .ok_or(BettingError::Overflow)?;
    }

    // total_matched tracks bettor stake matched per outcome
    market.total_matched[outcome as usize] = market.total_matched[outcome as usize]
        .checked_add(amount)
        .ok_or(BettingError::Overflow)?;

    // gross_payout = stake * odds = stake * odds_pct / 100
    let potential_payout = (amount as u128)
        .checked_mul(odds_pct as u128)
        .and_then(|v| v.checked_div(100))
        .ok_or(BettingError::Overflow)? as u64;

    // ── Init / update BetPosition ─────────────────────────────────────────────
    let position = &mut ctx.accounts.bet_position;
    if position.market == Pubkey::default() {
        position.market = market.key();
        position.bettor = ctx.accounts.bettor.key();
        position.outcome = outcome;
        position.matched_stake = 0;
        position.pending_stake = 0;
        position.odds_bps = odds_pct;
        position.potential_payout = 0;
        position.claimable = 0;
        position.claimed = false;
        position.bump = ctx.bumps.bet_position;
    }

    require!(position.outcome == outcome, BettingError::InvalidOutcome); // no mixed outcomes

    position.matched_stake = position
        .matched_stake
        .checked_add(amount)
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
        seeds = [b"position", market.key().as_ref(), bettor.key().as_ref(), &[outcome]],
        bump,
    )]
    pub bet_position: Account<'info, BetPosition>,

    #[account(mut)]
    pub bettor: Signer<'info>,

    pub system_program: Program<'info, System>,
}