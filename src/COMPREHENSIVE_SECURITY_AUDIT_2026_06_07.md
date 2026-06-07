# 🔒 ElevenX Security Audit Report - Comprehensive Review

**Audit Date:** 2026-06-07  
**Auditor:** Base44 AI Security Agent  
**Scope:** Smart contracts, backend functions, entity RLS, frontend components

---

## Executive Summary

### ✅ Previously Fixed Critical Issues
1. **Wrong Discriminator in Settlement** - FIXED ✅
   - Changed from `global:emergency_settle` to `global:submit_oracle_vote`
   - Added missing `oracle_vote` and `vote_tally` PDAs

2. **LP Withdrawal Locking Bug** - FIXED ✅
   - Replaced `withdrawn: bool` with `withdrawn_amount: u64` + `fully_withdrawn: bool`
   - LPs can now withdraw partial amounts without locking remaining funds

### ⚠️ New Critical Findings (Require Immediate Action)

---

## 🔴 CRITICAL SECURITY ISSUES

### 1. **Entity RLS Missing for UserBet** - CRITICAL

**File:** `entities/UserBet.json`

**Issue:** UserBet entity has NO Row Level Security (RLS) configured. Any authenticated user can read, update, or delete ANY other user's bets.

**Current State:**
```json
// No RLS section in UserBet entity
```

**Risk:** 
- Users can view other users' betting history
- Users can modify other users' bet statuses
- Users can delete other users' winning bets before claim
- Malicious users can change `actual_payout` values

**Exploit Scenario:**
```
1. Attacker creates account
2. Queries all UserBets: GET /api/entities/UserBet
3. Finds high-value winning bet (userBetId: "abc123")
4. Updates bet: PATCH /api/entities/UserBet/abc123
   { "status": "lost", "actual_payout": 0 }
5. Victim can no longer claim winnings
```

**Fix Required:**
```json
{
  "rls": {
    "create": {
      "$or": [
        { "data.wallet_address": "{{user.wallet_address}}" },
        { "user_condition": { "role": "admin" } }
      ]
    },
    "read": {
      "$or": [
        { "data.wallet_address": "{{user.wallet_address}}" },
        { "user_condition": { "role": "admin" } }
      ]
    },
    "update": {
      "$or": [
        { "data.wallet_address": "{{user.wallet_address}}" },
        { "user_condition": { "role": "admin" } }
      ]
    },
    "delete": {
      "$or": [
        { "data.wallet_address": "{{user.wallet_address}}" },
        { "user_condition": { "role": "admin" } }
      ]
    }
  }
}
```

**Priority:** 🔴 CRITICAL - Deploy within 24 hours

---

### 2. **Entity RLS Missing for BetOffer** - CRITICAL

**File:** `entities/BetOffer.json`

**Issue:** BetOffer entity has NO RLS. Any user can modify or delete LP offers.

**Risk:**
- Users can delete other users' LP offers
- Users can modify `amount_matched`, `amount_unmatched`
- Users can change offer status to prevent betting

**Fix Required:**
```json
{
  "rls": {
    "create": {
      "$or": [
        { "data.lp_wallet_address": "{{user.wallet_address}}" },
        { "user_condition": { "role": "admin" } }
      ]
    },
    "read": true, // Public read is OK for offer book
    "update": {
      "$or": [
        { "data.lp_wallet_address": "{{user.wallet_address}}" },
        { "user_condition": { "role": "admin" } }
      ]
    },
    "delete": {
      "$or": [
        { "data.lp_wallet_address": "{{user.wallet_address}}" },
        { "user_condition": { "role": "admin" } }
      ]
    }
  }
}
```

**Priority:** 🔴 CRITICAL - Deploy within 24 hours

---

### 3. **Entity RLS Missing for LpPosition** - CRITICAL

**File:** `entities/LpPosition.json`

**Issue:** LpPosition entity has NO RLS configured.

**Risk:**
- Users can view all LP positions (privacy issue)
- Users can modify other users' LP positions
- Users can delete LP position records

**Fix Required:**
```json
{
  "rls": {
    "create": {
      "$or": [
        { "data.wallet_address": "{{user.wallet_address}}" },
        { "user_condition": { "role": "admin" } }
      ]
    },
    "read": {
      "$or": [
        { "data.wallet_address": "{{user.wallet_address}}" },
        { "user_condition": { "role": "admin" } }
      ]
    },
    "update": {
      "$or": [
        { "data.wallet_address": "{{user.wallet_address}}" },
        { "user_condition": { "role": "admin" } }
      ]
    },
    "delete": {
      "user_condition": { "role": "admin" } // LPs shouldn't delete positions
    }
  }
}
```

**Priority:** 🔴 CRITICAL - Deploy within 24 hours

---

### 4. **Backend Function: No Wallet Address Validation in Critical Functions** - HIGH

**Files:** `announceWinner.js`, `settleBetWithOracle.js`

**Issue:** These functions use `await base44.auth.me()` to check admin role, but don't validate that the admin's wallet matches the on-chain platform admin.

**Risk:**
- Admin with email login but WRONG wallet can settle markets
- Settlement transactions will fail on-chain (waste of gas)
- Database gets into inconsistent state

**Current Code:**
```javascript
const user = await base44.auth.me();
if (!user || user.role !== 'admin') {
  return Response.json({ error: 'Admin access required' }, { status: 403 });
}
// ❌ No wallet validation
```

**Fix:**
```javascript
const user = await base44.auth.me();
if (!user || user.role !== 'admin') {
  return Response.json({ error: 'Admin access required' }, { status: 403 });
}

// ✅ Validate wallet matches on-chain admin
const walletUsers = await base44.entities.WalletUser.filter({ 
  user_id: user.id 
});
const adminWallet = walletUsers[0]?.wallet_address;

// Fetch on-chain platform admin
const platformPda = PublicKey.findProgramAddressSync(
  [Buffer.from('platform')],
  programId
)[0];
const platformInfo = await connection.getAccountInfo(platformPda);
const onChainAdmin = new PublicKey(platformInfo.data.slice(8, 40)).toBase58();

if (adminWallet !== onChainAdmin) {
  return Response.json({ 
    error: 'Wallet mismatch - your wallet is not the platform admin',
    on_chain_admin: onChainAdmin,
    your_wallet: adminWallet
  }, { status: 403 });
}
```

**Priority:** 🟡 HIGH - Deploy within 48 hours

---

### 5. **Oracle Voting: No Vote Expiration** - MEDIUM

**File:** `solana-programs/.../instructions/oracle.rs`

**Issue:** Oracle votes never expire. An old vote from months ago could still count toward consensus.

**Risk:**
- Stale votes could trigger unintended settlement
- Oracle could change mind but old vote still counts

**Current Code:**
```rust
// No timestamp tracking on votes
pub struct OracleVote {
    pub market: Pubkey,
    pub oracle: Pubkey,
    pub outcome: u8,
    pub bump: u8,
}
```

**Fix:** Add `voted_at: i64` field and validate vote age
```rust
pub struct OracleVote {
    pub market: Pubkey,
    pub oracle: Pubkey,
    pub outcome: u8,
    pub voted_at: i64, // NEW: timestamp
    pub bump: u8,
}

// In submit_oracle_vote:
let clock = Clock::get()??;
require!(
    clock.unix_timestamp - vote.voted_at < 86400, // 24 hour expiry
    BettingError::VoteExpired
);
```

**Priority:** 🟡 MEDIUM - Deploy within 1 week

---

### 6. **Claim Winnings: No Rate Limiting** - MEDIUM

**File:** `functions/claimWinnings.js`

**Issue:** No rate limiting on claim operations. Malicious users could spam claims.

**Risk:**
- API abuse / denial of service
- Excessive Solana transaction fees
- Database performance degradation

**Fix:** Implement rate limiting
```javascript
// Add to UserBet entity
"last_claim_at": { "type": "string", "format": "date-time" }

// In claimWinnings.js
const now = new Date();
if (userBet.last_claim_at) {
  const lastClaim = new Date(userBet.last_claim_at);
  if (now - lastClaim < 60000) { // 1 minute cooldown
    return Response.json({ 
      error: 'Rate limit exceeded. Please wait 1 minute between claims.' 
    }, { status: 429 });
  }
}
```

**Priority:** 🟡 MEDIUM - Deploy within 1 week

---

## 🟡 MEDIUM SEVERITY ISSUES

### 7. **Futures Market: Manual Settlement Without On-Chain Verification**

**File:** `functions/settleFuturesWithOracle.js`

**Issue:** Function allows manual `manual_winning_position` without on-chain verification.

**Risk:** Admin could accidentally or maliciously set wrong winner.

**Recommendation:** 
- Deprecate this function completely
- Force all settlements through `settleFuturesMarketOnChain`
- Add 2-of-3 multisig for futures settlement

**Priority:** 🟡 MEDIUM

---

### 8. **No Emergency Pause Mechanism**

**Issue:** No global pause function to halt all betting in case of exploit.

**Risk:** If exploit discovered, cannot stop bleeding immediately.

**Fix:** Add `emergency_pause()` instruction to Solana program
```rust
pub fn emergency_pause(ctx: Context<EmergencyPause>) -> Result<()> {
    let config = &mut ctx.accounts.platform_config;
    config.paused = true;
    Ok(())
}
```

**Priority:** 🟡 MEDIUM

---

### 9. **Fee Vault: No Withdrawal Limits**

**File:** `functions/adminWithdrawLiquidity.js`

**Issue:** Admin can withdraw entire fee vault at once with no limits.

**Risk:** If admin compromised, attacker drains all fees immediately.

**Fix:** Implement withdrawal limits or timelock
```javascript
// Max 20% of vault per day
const maxWithdraw = feeVault.total_fees * 0.20;
if (amount > maxWithdraw) {
  return Response.json({ 
    error: `Daily withdrawal limit exceeded (max: ${maxWithdraw} SOL)` 
  }, { status: 400 });
}
```

**Priority:** 🟡 MEDIUM

---

## 🟢 LOW SEVERITY / BEST PRACTICES

### 10. **Inconsistent Error Messages**

**Issue:** Some functions return detailed errors, others return generic "Something went wrong".

**Fix:** Standardize error format across all functions
```javascript
return Response.json({
  error: 'Human-readable message',
  code: 'ERROR_CODE',
  hint: 'Suggested action',
  details: { /* debug info */ }
}, { status: 400 });
```

---

### 11. **No Unit Tests for Critical Functions**

**Missing Tests:**
- Settlement with multiple winners
- LP partial withdrawal scenarios
- Oracle vote consensus edge cases
- Claim with insufficient market balance

**Recommendation:** Add comprehensive test suite

---

### 12. **Database: No Indexes on Frequently Queried Fields**

**Issue:** Queries on `wallet_address`, `bet_id`, `status` fields are slow without indexes.

**Fix:** Add database indexes
```json
// In entity definitions
"indexes": [
  { "fields": ["wallet_address", "status"] },
  { "fields": ["bet_id", "role"] },
  { "fields": ["match_id", "outcome"] }
]
```

---

## 📊 Entity RLS Audit Summary

| Entity | Create | Read | Update | Delete | Status |
|--------|--------|------|--------|--------|--------|
| User | ✅ Admin only | ✅ Owner/Admin | ✅ Owner/Admin | ✅ Admin only | SECURE |
| WalletUser | ✅ Owner/Admin | ✅ Owner/Admin | ✅ Owner/Admin | ✅ Admin only | SECURE |
| Match | ✅ Admin only | ✅ Public | ✅ Admin only | ✅ Admin only | SECURE |
| Bet | ✅ Admin only | ✅ Public | ✅ Admin only | ✅ Admin only | SECURE |
| **UserBet** | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | 🔴 CRITICAL |
| **BetOffer** | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | 🔴 CRITICAL |
| **LpPosition** | ❌ NONE | ❌ NONE | ❌ NONE | ❌ NONE | 🔴 CRITICAL |
| FuturesMarket | ✅ Admin only | ✅ Public | ✅ Admin only | ✅ Admin only | SECURE |

---

## 🎯 Immediate Action Plan (Next 72 Hours)

### Day 1 (CRITICAL):
1. ✅ Add RLS to UserBet entity
2. ✅ Add RLS to BetOffer entity  
3. ✅ Add RLS to LpPosition entity
4. ✅ Test RLS with "Act as user" feature

### Day 2 (HIGH):
5. ✅ Add wallet validation to settlement functions
6. ✅ Add rate limiting to claimWinnings
7. ✅ Run security scan in Dashboard

### Day 3 (MEDIUM):
8. ✅ Add vote expiration to oracle.rs
9. ✅ Add emergency pause mechanism
10. ✅ Add fee vault withdrawal limits
11. ✅ Create unit tests for critical flows

---

## 🔐 Security Scan Checklist

Before deploying fixes:
- [ ] Run Base44 Security Scan (Dashboard → Security)
- [ ] Test RLS with multiple user accounts
- [ ] Verify wallet validation in settlement
- [ ] Test rate limiting on claims
- [ ] Deploy Solana program updates to devnet
- [ ] Test all critical flows on devnet
- [ ] Document all changes in changelog

---

## 📈 Risk Matrix

| Issue | Likelihood | Impact | Risk Score |
|-------|------------|--------|------------|
| UserBet RLS Missing | HIGH | CRITICAL | 🔴 10/10 |
| BetOffer RLS Missing | HIGH | CRITICAL | 🔴 10/10 |
| LpPosition RLS Missing | MEDIUM | CRITICAL | 🟡 8/10 |
| No Wallet Validation | MEDIUM | HIGH | 🟡 7/10 |
| No Vote Expiration | LOW | MEDIUM | 🟢 4/10 |
| No Rate Limiting | MEDIUM | MEDIUM | 🟡 6/10 |

---

## ✅ Positive Security Findings

1. **Admin Authentication:** All critical endpoints properly check `user.role === 'admin'`
2. **On-Chain Validation:** Claim functions verify market settlement on-chain
3. **PDA Derivation:** Correct PDA seeds used across all functions
4. **Overflow Protection:** Rust code uses `checked_add`, `checked_sub` everywhere
5. **Wallet Address Validation:** Proper base58 regex validation
6. **Error Handling:** Comprehensive try/catch blocks in backend functions

---

## 📞 Support & Escalation

If you discover any exploits or vulnerabilities:
1. **Immediately** pause the platform (add `paused = true` to platform config)
2. Contact Base44 support
3. Preserve all logs and transaction history
4. Do NOT attempt to fix on-chain issues without proper testing

---

**Audit Completed:** 2026-06-07  
**Next Scheduled Audit:** 2026-07-07 (Monthly)  
**Auditor Signature:** Base44 AI Security Agent