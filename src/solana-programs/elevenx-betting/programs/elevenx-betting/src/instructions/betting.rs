use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::{BetMarket, BetPosition};
use crate::errors::BettingError;

// ── place_bet ─────────────────────────────────────────────────────────────────

pub fn place_bet(ctx: Context<PlaceBet>, outcome: u8, amount: u64) -> Result<()> {
    let clock = Clock::get()?;
    let market = &mut ctx.accounts.market;

    require!(!market.paused, BettingError::MarketPaused);
    require!(!market.settled && !market.voided, BettingError::AlreadySettled);
    require!(clock.unix_timestamp < market.open_until, BettingError::BettingClosed);
    require!(outcome < market.outcome_count, BettingError::InvalidOutcome);
    require!(amount > 0, BettingError::ZeroStake);

    // Transfer SOL from bettor to the market PDA (acts as escrow).
    let cpi_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        system_program::Transfer {
            from: ctx.accounts.bettor.to_account_info(),
            to: ctx.accounts.market.to_account_info(),
        },
    );
    system_program::transfer(cpi_ctx, amount)?;

    // Update market totals.
    market.total_by_outcome[outcome as usize] = market
        .total_by_outcome[outcome as usize]
        .checked_add(amount)
        .ok_or(BettingError::Overflow)?;
    market.total_all = market.total_all.checked_add(amount).ok_or(BettingError::Overflow)?;

    // Update (or initialize) bettor position.
    let position = &mut ctx.accounts.bet_position;
    if position.market == Pubkey::default() {
        // First bet — initialize.
        position.market = market.key();
        position.bettor = ctx.accounts.bettor.key();
        position.stakes = [0u64; 3];
        position.claimable = 0;
        position.claimed = false;
        position.bump = ctx.bumps.bet_position;
    }
    position.stakes[outcome as usize] = position.stakes[outcome as usize]
        .checked_add(amount)
        .ok_or(BettingError::Overflow)?;

    Ok(())
}

// ── Accounts ──────────────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(outcome: u8, amount: u64)]
pub struct PlaceBet<'info> {
    #[account(
        mut,
        seeds = [b"market", &market.match_id],
        bump = market.bump,
    )]
    pub market: Account<'info, BetMarket>,

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