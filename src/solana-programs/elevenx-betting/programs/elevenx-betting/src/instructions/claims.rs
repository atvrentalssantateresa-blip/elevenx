use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::{BetMarket, BetPosition, FeeVault, LpOffer};
use crate::errors::BettingError;

// ── claim_winnings ────────────────────────────────────────────────────────────
//
// Hybrid fixed-odds payout:
//   - Bettor's payout = potential_payout (locked in at bet placement).
//   - potential_payout = matched_stake * odds_bps / 100.
//   - Fee is deducted from payout at claim time.
//   - Only matched_stake is eligible; pending_stake is refunded separately.

pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
    let market = &ctx.accounts.market;
    let position = &ctx.accounts.bet_position;

    require!(market.settled && !market.voided, BettingError::AlreadySettled);
    require!(!position.claimed, BettingError::ClaimNothing);
    require!(
        position.outcome == market.winning_outcome,
        BettingError::ClaimNothing
    );
    require!(position.matched_stake > 0, BettingError::ClaimNothing);

    let gross = position.potential_payout;
    require!(gross > 0, BettingError::ClaimNothing);

    let fee_percent = market.fee_percent as u64;
    let fee = gross
        .checked_mul(fee_percent)
        .and_then(|v| v.checked_div(10_000))
        .unwrap_or(0);
    let payout = gross.saturating_sub(fee);

    // Also refund any pending (unmatched) stake back to the bettor.
    let pending_refund = position.pending_stake;
    let total_transfer = payout.checked_add(pending_refund).ok_or(BettingError::Overflow)?;

    // Mark claimed before transfers (reentrancy guard).
    let position_mut = &mut ctx.accounts.bet_position;
    position_mut.claimed = true;
    position_mut.claimable = payout;

    // Transfer fee to fee vault.
    if fee > 0 {
        let fee_vault = &mut ctx.accounts.fee_vault;
        **ctx.accounts.market.to_account_info().try_borrow_mut_lamports()? -= fee;
        **fee_vault.to_account_info().try_borrow_mut_lamports()? += fee;
        fee_vault.total_fees = fee_vault.total_fees.saturating_add(fee);
    }

    // Transfer payout + pending refund from market PDA to bettor.
    **ctx.accounts.market.to_account_info().try_borrow_mut_lamports()? -= total_transfer;
    **ctx.accounts.bettor.try_borrow_mut_lamports()? += total_transfer;

    Ok(())
}

// ── refund ────────────────────────────────────────────────────────────────────
//
// On voided market: return matched_stake + pending_stake to bettor.

pub fn refund(ctx: Context<Refund>) -> Result<()> {
    let market = &ctx.accounts.market;
    let position = &ctx.accounts.bet_position;

    require!(market.voided, BettingError::NotVoided);
    require!(!position.claimed, BettingError::NothingToRefund);

    let total_stake = position
        .matched_stake
        .checked_add(position.pending_stake)
        .ok_or(BettingError::Overflow)?;
    require!(total_stake > 0, BettingError::NothingToRefund);

    let position_mut = &mut ctx.accounts.bet_position;
    position_mut.claimed = true;
    position_mut.matched_stake = 0;
    position_mut.pending_stake = 0;

    **ctx.accounts.market.to_account_info().try_borrow_mut_lamports()? -= total_stake;
    **ctx.accounts.bettor.try_borrow_mut_lamports()? += total_stake;

    Ok(())
}

// ── withdraw_lp_winnings ─────────────────────────────────────────────────────
//
// LP withdraws winnings from a settled market when their backed outcome won.
// Payout = LP's share of the losing side's stakes (matched against their liquidity).

pub fn withdraw_lp_winnings(ctx: Context<WithdrawLpWinnings>, amount: u64) -> Result<()> {
    let market = &ctx.accounts.market;
    let lp_offer = &ctx.accounts.lp_offer;

    // Market must be settled and not voided
    require!(market.settled && !market.voided, BettingError::AlreadySettled);
    
    // LP offer must be for the winning outcome
    require!(
        lp_offer.outcome == market.winning_outcome,
        BettingError::ClaimNothing
    );
    
    // Must have matched stake (liquidity that was used)
    require!(lp_offer.matched_stake > 0, BettingError::ClaimNothing);
    
    // Ensure amount doesn't exceed what's available
    require!(amount <= lp_offer.matched_stake, BettingError::ClaimNothing);

    // Calculate fee (2% of winnings)
    let fee_percent = market.fee_percent as u64;
    let fee = amount
        .checked_mul(fee_percent)
        .and_then(|v| v.checked_div(10_000))
        .unwrap_or(0);
    let payout = amount.saturating_sub(fee);

    // Mark as withdrawn before transfers (reentrancy guard)
    let lp_offer_mut = &mut ctx.accounts.lp_offer;
    lp_offer_mut.withdrawn = true;
    lp_offer_mut.matched_stake = 0;

    // Transfer fee to fee vault
    if fee > 0 {
        let fee_vault = &mut ctx.accounts.fee_vault;
        **ctx.accounts.market.to_account_info().try_borrow_mut_lamports()? -= fee;
        **fee_vault.to_account_info().try_borrow_mut_lamports()? += fee;
        fee_vault.total_fees = fee_vault.total_fees.saturating_add(fee);
    }

    // Transfer payout from market PDA to LP wallet
    **ctx.accounts.market.to_account_info().try_borrow_mut_lamports()? -= payout;
    **ctx.accounts.lp_wallet.try_borrow_mut_lamports()? += payout;

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

// ── withdraw_lp_winnings ─────────────────────────────────────────────────────
//
// LP withdraws winnings from a settled market when their backed outcome won.

pub fn withdraw_lp_winnings(ctx: Context<WithdrawLpWinnings>, amount: u64) -> Result<()> {
    let market = &ctx.accounts.market;
    let lp_offer = &ctx.accounts.lp_offer;

    require!(market.settled && !market.voided, BettingError::AlreadySettled);
    require!(!lp_offer.closed, BettingError::ClaimNothing);
    require!(
        lp_offer.outcome == market.winning_outcome,
        BettingError::ClaimNothing
    );
    require!(amount > 0, BettingError::ZeroStake);

    // Mark offer as closed (claimed)
    let offer_mut = &mut ctx.accounts.lp_offer;
    offer_mut.closed = true;

    // Transfer winnings from market PDA to LP
    **ctx.accounts.market.to_account_info().try_borrow_mut_lamports()? -= amount;
    **ctx.accounts.lp.try_borrow_mut_lamports()? += amount;

    Ok(())
}

#[derive(Accounts)]
pub struct WithdrawLpWinnings<'info> {
    #[account(
        mut,
        seeds = [b"market", &market.match_id],
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

    /// CHECK: Lamport transfer only; address verified by lp_offer.lp
    #[account(mut)]
    pub lp: Signer<'info>,

    #[account(mut, seeds = [b"fee_vault"], bump = fee_vault.bump)]
    pub fee_vault: Account<'info, FeeVault>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawLpWinnings<'info> {
    #[account(
        mut,
        seeds = [b"market", &market.match_id],
        bump = market.bump,
    )]
    pub market: Account<'info, BetMarket>,

    #[account(
        mut,
        seeds = [b"lp_offer", market.key().as_ref(), lp_offer.lp.as_ref(), &[lp_offer.outcome]],
        bump = lp_offer.bump,
        constraint = lp_offer.lp == lp_wallet.key() @ BettingError::Unauthorized,
    )]
    pub lp_offer: Account<'info, LpOffer>,

    #[account(mut, seeds = [b"fee_vault"], bump = fee_vault.bump)]
    pub fee_vault: Account<'info, FeeVault>,

    /// CHECK: Lamport transfer only; address verified by lp_offer.lp.
    #[account(mut, constraint = lp_wallet.key() == lp_offer.lp @ BettingError::Unauthorized)]
    pub lp_wallet: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}