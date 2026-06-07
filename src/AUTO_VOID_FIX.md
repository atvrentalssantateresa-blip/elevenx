# 🔧 Auto-Voided Market Fix

## Problem
When LPs tried to withdraw winnings from settled markets, they encountered error **6001 (`AlreadySettled`)** even when the market was properly settled. This occurred because:

1. **Auto-Void Mechanism**: When no one bets on the winning outcome, the Solana program automatically voids the market (`market.voided = true`) to protect funds
2. **Missing Check**: The `withdrawLpWinnings` function didn't check for the `voided` state before attempting withdrawal
3. **Contract Constraint**: The `withdraw_lp_winnings` instruction requires `!market.voided`, causing the 6001 error

## Root Cause
In the test market "Quick Test A vs Quick Test B":
- LP provided liquidity for outcome **A**
- Bettor placed a bet on outcome **A**
- No bets were placed on outcome **B**
- Market settled with **B** as winner
- Since `winners_pool == 0` (no bets on winning outcome), the contract auto-voided
- LP withdrawal failed with 6001 error

## Solution

### 1. Backend Fix (`functions/withdrawLpWinnings`)
Added on-chain state validation to detect auto-voided markets:

```javascript
// Check if market was auto-voided (no bets on winning outcome)
const settledByte = marketData[244];
const voidedByte = marketData[245];

if (voidedByte) {
  return Response.json({ 
    error: 'Market was auto-voided (no bets on winning outcome)',
    hint: 'When no one bet on the winning outcome, the market auto-voids and LPs should withdraw their unmatched liquidity instead of winnings.',
    action: 'withdraw_unmatched'
  }, { status: 400 });
}
```

### 2. Frontend Error Handling (`components/lp/LpPositionCard`)
Added user-friendly error message for auto-voided markets:

```javascript
if (errorMsg.includes('auto-voided') || errorMsg.includes('no bets on winning outcome')) {
  userMessage = '⚠️ Market Auto-Voided\n\nNo one bet on the winning outcome, so the market was automatically voided.\n\nYour unmatched liquidity can still be withdrawn - use "Withdraw Unmatched" instead.';
}
```

### 3. Dashboard Error Handling (`pages/LpDashboard`)
Added error handling in the withdraw mutation:

```javascript
if (err.message?.includes('auto-voided') || err.message?.includes('no bets on winning outcome')) {
  errorMsg = '⚠️ Market Auto-Voided\n\nNo one bet on the winning outcome, so the market was automatically voided.\n\nYour unmatched liquidity can still be withdrawn - use "Withdraw Unmatched" instead.';
}
```

## How It Works Now

### Normal LP Withdrawal (Winning LP)
1. LP backed outcome **A**, outcome **B** won
2. Bettors placed bets on outcome **A** (matched against LP)
3. Market settles with **B** as winner
4. LP withdraws winnings (matched stake + fees) ✅

### Auto-Voided Market
1. LP backed outcome **A**, outcome **B** won
2. **NO bettors** placed bets on outcome **B** (winning outcome)
3. Market auto-voids (protects LP funds)
4. LP sees error message: "Market was auto-voided"
5. LP uses "Withdraw Unmatched" to get funds back ✅

## Testing

### To Test a Successful LP Withdrawal:
1. Create a test market
2. Add LP liquidity for outcome **A** AND outcome **B**
3. Place a bet on outcome **A** (matches LP A)
4. Place a bet on outcome **B** (matches LP B)
5. Settle market with outcome **B** as winner
6. LP who backed **A** (losing outcome) can withdraw winnings ✅

### To Test Auto-Void Detection:
1. Create a test market
2. Add LP liquidity for outcome **A** only
3. Place a bet on outcome **A**
4. Settle market with outcome **B** as winner (no bets on B)
5. Market auto-voids
6. LP sees auto-void message and withdraws unmatched liquidity ✅

## Files Changed
- `functions/withdrawLpWinnings` - Added voided state check
- `components/lp/LpPositionCard` - Added error handling
- `pages/LpDashboard` - Added error handling

## Impact
- ✅ LPs no longer see cryptic 6001 errors
- ✅ Clear guidance on what to do when markets auto-void
- ✅ Unmatched liquidity always accessible
- ✅ Better user experience for edge cases