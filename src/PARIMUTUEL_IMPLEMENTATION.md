# Pari-Mutuel Betting Implementation

## Overview
Successfully migrated from **Fixed-Odds LP Model** to **Pari-Mutuel Pool Model** for the ElevenX betting platform on Solana.

## Key Changes

### 1. Smart Contract (Solana Program)
**Program ID:** `PMut1111111111111111111111111111111111111111`

#### State Changes
- **Removed:** `oracle_odds`, `total_matched`, `total_pending`, `total_lp_committed`
- **Added:** `pool: [u64; 3]` (tracks SOL per outcome), `total_pool: u64`
- **PDA Seeds Updated:**
  - Market: `["pm_market", match_id]`
  - Position: `["pm_position", market_pubkey, bettor_pubkey, &[outcome]]`
  - Platform: `["pm_platform"]`
  - Fee Vault: `["pm_fee_vault"]`
  - Vote Tally: `["pm_vote_tally", market_pubkey]`

#### Instructions Simplified
- `place_bet`: No LP matching — just transfer SOL to market escrow and update pool
- `claim_winnings`: Pari-mutuel formula: `payout = stake × total_pool × (1 - fee%) / winner_pool`
- **Removed:** `provide_liquidity`, `withdraw_liquidity`, `withdraw_lp_winnings`

### 2. Backend Functions Updated

#### `functions/placeBet.js`
- Removed LP offer lookup and matching logic
- Simplified PDA derivation (uses `pm_market`, `pm_position` seeds)
- Updates `pool_a/pool_b/pool_draw` and `total_pool` on Bet entity
- All bets immediately "active" (no pending LP wait)

#### `functions/claimWinnings.js`
- Updated PDA seeds for pari-mutuel
- Removed fixed-odds payout calculation (handled on-chain)

#### `functions/checkMarketStatus.js`
- Updated PDA seed to `pm_market`
- Updated expected size: 210 bytes (PoolMarket struct)

#### `functions/createMarketOnChain.js`
- Updated PDA seeds (`pm_market`, `pm_platform`, `pm_fee_vault`, `pm_vote_tally`)
- Removed oracle_odds from instruction data
- Smaller instruction payload (155 bytes vs 171 bytes)

### 3. Entity Schema Changes

#### `entities/Bet.json`
```json
{
  "pool_a": 0,      // NEW: SOL pooled on outcome A
  "pool_b": 0,      // NEW: SOL pooled on outcome B
  "pool_draw": 0,   // NEW: SOL pooled on Draw
  "total_pool": 0,  // Total SOL in all pools
  // REMOVED: oracle_odds_a/b/draw, lp_amount_a/b/draw, backed_amount_a/b/draw
}
```

### 4. Frontend Changes

#### `pages/MatchDetail.jsx`
- Imported `calculateParimutuelOdds` utility
- Replaced `getOracleOdds()` with `getParimutuelOdds()`
- Updated display to show dynamic pool-based odds
- Removed LP-related UI (no "Open Offer" vs "Match Bet" modes)
- Simplified betting flow: just select outcome and stake amount

#### `utils/parimutuel.js` (NEW)
```javascript
export function calculateParimutuelOdds(poolA, poolB, poolDraw, totalPool, feePercent = 200) {
  const feeMultiplier = (10000 - feePercent) / 10000;
  const netPool = totalPool * feeMultiplier;
  
  const oddsA = poolA > 0 ? netPool / poolA : null;
  const oddsB = poolB > 0 ? netPool / poolB : null;
  const oddsDraw = poolDraw > 0 ? netPool / poolDraw : null;
  
  return { oddsA, oddsB, oddsDraw, netPool };
}
```

## Pari-Mutuel Odds Formula

```
odds[i] = (total_pool × (1 - fee%)) / pool[i]
```

**Example:**
- Brazil pool: 15 SOL, Italy pool: 2 SOL, Draw: 0 SOL
- Total pool: 17 SOL, Fee: 2%
- Net pool after fee: 17 × 0.98 = 16.66 SOL

**Odds:**
- Brazil: 16.66 / 15 = **1.11×**
- Italy: 16.66 / 2 = **8.33×**
- Draw: undefined (no bets yet)

**Payout Example:**
If you bet 1 SOL on Italy (8.33×) and Italy wins:
- Payout = 1 × 8.33 = **8.33 SOL** (profit: 7.33 SOL)

## Benefits of Pari-Mutuel Model

1. **No LP Required** — Bettors bet directly against each other
2. **Dynamic Odds** — Odds update automatically as bets come in
3. **Simpler Architecture** — No LP offer matching, no pending states
4. **Fair Distribution** — Winners share losers' pool proportionally
5. **Lower Complexity** — Fewer account PDAs, simpler transaction flow

## Deployment Checklist

- [x] Update Solana program with pari-mutuel logic
- [x] Update backend functions (`placeBet`, `claimWinnings`, `checkMarketStatus`, `createMarketOnChain`)
- [x] Update Bet entity schema (remove LP fields, add pool fields)
- [x] Update frontend odds calculation and display
- [x] Remove LP-related UI components
- [ ] Deploy new Solana program to devnet
- [ ] Update `SOLANA__PROGRAM_ID` secret with new program ID
- [ ] Test market creation, betting, and claiming flows

## Next Steps

1. **Deploy the new Solana program** using Anchor:
   ```bash
   cd solana-programs/elevenx-betting
   anchor build
   anchor deploy
   ```

2. **Update the program ID** in Base44 secrets:
   - Go to Dashboard → Settings → Secrets
   - Update `SOLANA__PROGRAM_ID` to the new deployed address

3. **Initialize platform config** (one-time):
   - Admin signs `initialize_platform` transaction
   - Sets fee percent (2%) and consensus threshold (51%)

4. **Test the complete flow:**
   - Create a match → Create market → Place bets → Settle → Claim winnings

---

**Status:** Backend and frontend updated ✅ | Smart contract pending deployment ⏳