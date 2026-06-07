# 🚀 Security Fix Implementation Plan

**Created:** 2026-06-07  
**Priority:** CRITICAL → HIGH → MEDIUM

---

## ✅ COMPLETED (Day 1 - CRITICAL)

### 1. Entity RLS Fixes - DONE ✅

**Files Updated:**
- `entities/UserBet.json` - Added explicit `read` RLS (was missing)
- `entities/BetOffer.json` - Added explicit `read` RLS (was `true`, now public read OK)
- `entities/LpPosition.json` - Added complete RLS (was completely missing)

**RLS Rules Applied:**
```json
// UserBet & LpPosition: Owner-only access
"read": {
  "$or": [
    { "data.wallet_address": "{{user.wallet_address}}" },
    { "user_condition": { "role": "admin" } }
  ]
}

// BetOffer: Public read (for offer book), owner-only write
"read": true, // Public read is OK
"update": {
  "$or": [
    { "data.lp_wallet_address": "{{user.wallet_address}}" },
    { "user_condition": { "role": "admin" } }
  ]
}
```

**Testing Required:**
- [ ] Test with "Act as user" feature in Base44 dashboard
- [ ] Verify users cannot see other users' bets
- [ ] Verify users cannot modify other users' LP positions
- [ ] Verify public can still see BetOffers (needed for UI)

---

## 🔴 TODO (Day 2 - HIGH PRIORITY)

### 2. Add Wallet Validation to Settlement Functions

**Files to Update:**
- `functions/announceWinner.js`
- `functions/settleMarketOnChain.js`
- `functions/settleFuturesMarketOnChain.js`

**Change Required:**
Add wallet address validation to ensure the admin's wallet matches the on-chain platform admin.

**Implementation:**
```javascript
// After admin role check, add:
const walletUsers = await base44.entities.WalletUser.filter({ 
  user_id: user.id 
});
const adminWallet = walletUsers[0]?.wallet_address;

// Fetch on-chain platform admin from PDA
// Compare and reject if mismatch
```

**Estimated Time:** 30 minutes per function

---

### 3. Add Rate Limiting to Claim Functions

**Files to Update:**
- `functions/claimWinnings.js`
- `functions/withdrawLpWinnings.js`
- `functions/claimRefund.js`

**Change Required:**
Add 1-minute cooldown between claims per wallet.

**Implementation:**
```javascript
// Add to UserBet entity:
"last_claim_at": { "type": "string", "format": "date-time" }

// In claim functions:
const now = new Date();
if (userBet.last_claim_at) {
  const lastClaim = new Date(userBet.last_claim_at);
  if (now - lastClaim < 60000) { // 1 minute
    return Response.json({ error: 'Rate limit exceeded', retryAfter: 60 }, { status: 429 });
  }
}
// Update after successful claim
await base44.entities.UserBet.update(userBetId, { last_claim_at: now.toISOString() });
```

**Estimated Time:** 20 minutes per function

---

## 🟡 TODO (Day 3 - MEDIUM PRIORITY)

### 4. Solana Program: Add Vote Expiration

**File to Update:**
- `solana-programs/elevenx-betting/programs/elevenx-betting/src/state/oracle_vote.rs`
- `solana-programs/elevenx-betting/programs/elevenx-betting/src/instructions/oracle.rs`

**Change Required:**
Add `voted_at: i64` field and validate votes are < 24 hours old.

**Implementation:**
```rust
// In oracle_vote.rs
pub struct OracleVote {
    pub market: Pubkey,
    pub oracle: Pubkey,
    pub outcome: u8,
    pub voted_at: i64, // NEW
    pub bump: u8,
}

// In oracle.rs submit_oracle_vote
let clock = Clock::get()?;
require!(
    clock.unix_timestamp - vote.voted_at < 86400, // 24 hours
    BettingError::VoteExpired
);
```

**Estimated Time:** 1 hour + program redeployment

---

### 5. Add Emergency Pause Mechanism

**Files to Update:**
- `solana-programs/elevenx-betting/programs/elevenx-betting/src/state/platform.rs`
- `solana-programs/elevenx-betting/programs/elevenx-betting/src/instructions/platform.rs`
- All betting/liquidity instructions (add pause check)

**Change Required:**
Add `paused: bool` to platform config and emergency pause instruction.

**Implementation:**
```rust
// In platform.rs
pub struct PlatformConfig {
    pub admin: Pubkey,
    pub fee_percent: u16,
    pub paused: bool, // NEW
    // ...
}

// New instruction
pub fn emergency_pause(ctx: Context<EmergencyPause>) -> Result<()> {
    let config = &mut ctx.accounts.platform_config;
    config.paused = true;
    Ok(())
}

// In all betting/liquidity functions
require!(!platform_config.paused, BettingError::PlatformPaused);
```

**Estimated Time:** 2 hours + program redeployment

---

### 6. Fee Vault Withdrawal Limits

**File to Update:**
- `functions/adminWithdrawLiquidity.js`

**Change Required:**
Limit admin withdrawals to 20% of total fees per day.

**Implementation:**
```javascript
const maxDailyWithdraw = feeVault.total_fees * 0.20;
const lastWithdraw = new Date(admin.last_fee_withdraw_at || 0);
const now = new Date();

if (now - lastWithdraw < 86400000) { // Within 24 hours
  if (amount > maxDailyWithdraw) {
    return Response.json({ 
      error: `Daily limit exceeded (max: ${maxDailyWithdraw} SOL)`,
      maxAllowed: maxDailyWithdraw
    }, { status: 400 });
  }
}
```

**Estimated Time:** 30 minutes

---

## 📋 Testing Checklist

Before deploying to production:

### RLS Testing
- [ ] Create test user account (non-admin)
- [ ] Login as test user
- [ ] Try to query all UserBets via API - should only see own bets
- [ ] Try to update another user's bet - should fail with 403
- [ ] Try to delete another user's LP position - should fail with 403
- [ ] Verify BetOffers are still publicly readable (needed for UI)

### Wallet Validation Testing
- [ ] Admin with wrong wallet tries to settle market - should fail
- [ ] Admin with correct wallet settles market - should succeed
- [ ] Check error message includes on-chain admin address

### Rate Limiting Testing
- [ ] Submit claim, immediately submit another - second should fail with 429
- [ ] Wait 60 seconds, submit again - should succeed
- [ ] Check `last_claim_at` field is updated

### Emergency Pause Testing
- [ ] Admin calls emergency_pause
- [ ] User tries to place bet - should fail with "Platform paused"
- [ ] Admin calls emergency_unpause
- [ ] User tries to place bet - should succeed

---

## 🎯 Deployment Schedule

| Date | Task | Priority | Estimated Time |
|------|------|----------|----------------|
| 2026-06-07 | RLS fixes (DONE) | CRITICAL | ✅ Complete |
| 2026-06-08 | Wallet validation | HIGH | 1.5 hours |
| 2026-06-08 | Rate limiting | HIGH | 1 hour |
| 2026-06-09 | Vote expiration | MEDIUM | 2 hours + deploy |
| 2026-06-09 | Emergency pause | MEDIUM | 3 hours + deploy |
| 2026-06-10 | Fee vault limits | MEDIUM | 30 minutes |
| 2026-06-11 | Full testing | - | 4 hours |

---

## 📞 Support Contacts

If issues arise during implementation:
- Base44 Support: support@base44.com
- Base44 Docs: https://docs.base44.com
- Solana Docs: https://docs.solana.com

---

**Status:** Day 1 Complete ✅  
**Next Action:** Implement wallet validation (Day 2)