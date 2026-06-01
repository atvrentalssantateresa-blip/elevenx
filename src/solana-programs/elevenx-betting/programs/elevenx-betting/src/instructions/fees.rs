use anchor_lang::prelude::*;
use crate::state::{PlatformConfig, FeeVault};
use crate::errors::BettingError;

// ── withdraw_fees ─────────────────────────────────────────────────────────────

pub fn withdraw_fees(ctx: Context<WithdrawFees>, amount: u64) -> Result<()> {
    let fee_vault = &mut ctx.accounts.fee_vault;

    require!(amount > 0, BettingError::ZeroStake);
    require!(amount <= fee_vault.total_fees, BettingError::NothingToRefund);

    fee_vault.total_fees = fee_vault.total_fees.saturating_sub(amount);

    // Transfer lamports from fee vault PDA to admin.
    **ctx.accounts.fee_vault.to_account_info().try_borrow_mut_lamports()? -= amount;
    **ctx.accounts.admin.try_borrow_mut_lamports()? += amount;

    Ok(())
}

// ── Accounts ──────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct WithdrawFees<'info> {
    #[account(mut, seeds = [b"fee_vault"], bump = fee_vault.bump)]
    pub fee_vault: Account<'info, FeeVault>,

    #[account(seeds = [b"platform"], bump = platform_config.bump)]
    pub platform_config: Account<'info, PlatformConfig>,

    /// CHECK: Lamport transfer to admin only; address verified against platform config.
    #[account(mut, constraint = admin.key() == platform_config.admin @ BettingError::Unauthorized)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}