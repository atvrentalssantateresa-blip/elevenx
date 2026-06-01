use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::{BetMarket, BetPosition, FeeVault};
use crate::errors::BettingError;

// ── claim_winnings ────────────────────────────────────────────────────────────

pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
    let market = &ctx.accounts.market;
    let position = &ctx.accounts.bet_position;

    require!(market.settled && !market.voided, BettingError::AlreadySettled);
    require!(!position.claimed, BettingError::ClaimNothing);

    let winning_outcome = market.winning_outcome as usize;
    let stake = position.stakes[winning_outcome];
    require!(stake > 0, BettingError::ClaimNothing);

    let winners_pool = market.total_by_outcome[winning_outcome];
    let losers_pool = market.total_all.saturating_sub(winners_pool);
    let fee_percent = market.fee_percent as u64;

    // gross = stake + (stake * losers_pool) / winners_pool
    let proportional = (stake as u128)
        .checked_mul(losers_pool as u128)
        .and_then(|v| v.checked_div(winners_pool as u128))
        .unwrap_or(0) as u64;

    let gross = stake.checked_add(proportional).ok_or(BettingError::Overflow)?;
    let fee = gross.checked_mul(fee_percent).and_then(|v| v.checked_div(10_000)).unwrap_or(0);
    let payout = gross.saturating_sub(fee);

    // Mark position as claimed before transfer (reentrancy guard).
    let position_mut = &mut ctx.accounts.bet_position;
    position_mut.claimed = true;
    position_mut.claimable = payout;

    // Transfer fee to fee vault via lamport manipulation (PDA-owned SOL).
    if fee > 0 {
        let fee_vault = &mut ctx.accounts.fee_vault;
        **ctx.accounts.market.to_account_info().try_borrow_mut_lamports()? -= fee;
        **fee_vault.to_account_info().try_borrow_mut_lamports()? += fee;
        fee_vault.total_fees = fee_vault.total_fees.saturating_add(fee);
    }

    // Transfer payout from market PDA to bettor.
    **ctx.accounts.market.to_account_info().try_borrow_mut_lamports()? -= payout;
    **ctx.accounts.bettor.try_borrow_mut_lamports()? += payout;

    Ok(())
}

// ── refund ────────────────────────────────────────────────────────────────────

pub fn refund(ctx: Context<Refund>) -> Result<()> {
    let market = &ctx.accounts.market;
    let position = &ctx.accounts.bet_position;

    require!(market.voided, BettingError::NotVoided);
    require!(!position.claimed, BettingError::NothingToRefund);

    let total_stake: u64 = position.stakes.iter().sum();
    require!(total_stake > 0, BettingError::NothingToRefund);

    let position_mut = &mut ctx.accounts.bet_position;
    position_mut.claimed = true;
    position_mut.stakes = [0u64; 3];

    // Return full stake from market PDA to bettor.
    **ctx.accounts.market.to_account_info().try_borrow_mut_lamports()? -= total_stake;
    **ctx.accounts.bettor.try_borrow_mut_lamports()? += total_stake;

    Ok(())
}

// ── Accounts ──────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct ClaimWinnings<'info> {
    #[account(
        mut,
        seeds = [b"market", &market.match_id],
        bump = market.bump,
    )]
    pub market: Account<'info, BetMarket>,

    #[account(
        mut,
        seeds = [b"position", market.key().as_ref(), bettor.key().as_ref()],
        bump = bet_position.bump,
    )]
    pub bet_position: Account<'info, BetPosition>,

    #[account(mut, seeds = [b"fee_vault"], bump = fee_vault.bump)]
    pub fee_vault: Account<'info, FeeVault>,

    /// CHECK: We only write lamports to this account, address is verified by position.bettor.
    #[account(mut, constraint = bettor.key() == bet_position.bettor @ BettingError::Unauthorized)]
    pub bettor: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Refund<'info> {
    #[account(
        mut,
        seeds = [b"market", &market.match_id],
        bump = market.bump,
    )]
    pub market: Account<'info, BetMarket>,

    #[account(
        mut,
        seeds = [b"position", market.key().as_ref(), bettor.key().as_ref()],
        bump = bet_position.bump,
    )]
    pub bet_position: Account<'info, BetPosition>,

    /// CHECK: Lamport transfer only; address verified by position.bettor.
    #[account(mut, constraint = bettor.key() == bet_position.bettor @ BettingError::Unauthorized)]
    pub bettor: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}