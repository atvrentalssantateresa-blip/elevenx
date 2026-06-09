use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::{BetMarket, LpOffer};
use crate::errors::BettingError;

// ── provide_liquidity ─────────────────────────────────────────────────────────
//
// LP deposits SOL to cover bettors on a given outcome at the current oracle odds.
// The LP's SOL goes into the market PDA escrow. If the bettor wins, the LP's
// committed SOL (minus their stake-equivalent portion) pays the bettor.
// If the bettor loses, the LP earns the bettor's stake.

pub fn provide_liquidity(ctx: Context<ProvideLiquidity>, outcome: u8, amount: u64) -> Result<()> {
    let clock = Clock::get()?;

    // Read-only checks before mutating.
    {
        let market = &ctx.accounts.market;
        require!(!market.paused, BettingError::MarketPaused);
        require!(!market.settled && !market.voided, BettingError::AlreadySettled);
        require!(clock.unix_timestamp < market.open_until, BettingError::BettingClosed);
        require!(outcome < market.outcome_count, BettingError::InvalidOutcome);
        require!(amount > 0, BettingError::ZeroStake);
        require!(market.oracle_odds[outcome as usize] > 100, BettingError::InvalidOutcome);
    }

    // Transfer SOL from LP into market escrow.
    let cpi_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        system_program::Transfer {
            from: ctx.accounts.lp.to_account_info(),
            to: ctx.accounts.market.to_account_info(),
        },
    );
    system_program::transfer(cpi_ctx, amount)?;

    // Update market totals.
    let market = &mut ctx.accounts.market;
    market.total_lp_committed = market
        .total_lp_committed
        .checked_add(amount)
        .ok_or(BettingError::Overflow)?;

    // Initialize or update LP offer account.
    let offer = &mut ctx.accounts.lp_offer;
    if offer.market == Pubkey::default() {
        offer.market = market.key();
        offer.lp = ctx.accounts.lp.key();
        offer.outcome = outcome;
        offer.odds_bps = market.oracle_odds[outcome as usize];
        offer.amount_committed = 0;
        offer.amount_matched = 0;
        offer.closed = false;
        offer.matched_stake = 0;
        offer.withdrawn_amount = 0;
        offer.fully_withdrawn = false;
        offer.bump = ctx.bumps.lp_offer;
    }

    offer.amount_committed = offer
        .amount_committed
        .checked_add(amount)
        .ok_or(BettingError::Overflow)?;

    Ok(())
}

// ── withdraw_liquidity ────────────────────────────────────────────────────────
//
// LP withdraws unmatched liquidity before market closes.

pub fn withdraw_liquidity(ctx: Context<WithdrawLiquidity>) -> Result<()> {
    let clock = Clock::get()?;
    let market = &mut ctx.accounts.market;
    let offer = &mut ctx.accounts.lp_offer;

    // Allow withdrawal if market is still open OR if market is settled (for unmatched funds)
    let is_open = clock.unix_timestamp < market.open_until;
    let is_settled = market.settled;
    require!(is_open || is_settled, BettingError::BettingClosed);
    require!(!offer.fully_withdrawn, BettingError::ClaimNothing);

    let available = offer.available();
    require!(available > 0, BettingError::ZeroStake);

    // Mark offer closed and reduce market totals.
    offer.closed = true;
    market.total_lp_committed = market.total_lp_committed.saturating_sub(available);

    // Transfer unmatched SOL back to LP.
    **ctx.accounts.market.to_account_info().try_borrow_mut_lamports()? -= available;
    **ctx.accounts.lp.try_borrow_mut_lamports()? += available;

    Ok(())
}

// ── Accounts ──────────────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(outcome: u8, amount: u64)]
pub struct ProvideLiquidity<'info> {
    #[account(
        mut,
        seeds = [b"market", market.match_id.as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, BetMarket>,

    #[account(
        init_if_needed,
        payer = lp,
        space = LpOffer::LEN,
        seeds = [b"lp_offer", market.key().as_ref(), lp.key().as_ref(), &[outcome]],
        bump,
    )]
    pub lp_offer: Account<'info, LpOffer>,

    #[account(mut)]
    pub lp: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawLiquidity<'info> {
    #[account(
        mut,
        seeds = [b"market", market.match_id.as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, BetMarket>,

    #[account(
        mut,
        seeds = [b"lp_offer", market.key().as_ref(), lp.key().as_ref(), &[lp_offer.outcome]],
        bump = lp_offer.bump,
        constraint = lp_offer.lp == lp.key() @ BettingError::Unauthorized,
    )]
    pub lp_offer: Account<'info, LpOffer>,

    /// CHECK: Lamport transfer only; address verified by lp_offer.lp.
    #[account(mut)]
    pub lp: Signer<'info>,

    pub system_program: Program<'info, System>,
}