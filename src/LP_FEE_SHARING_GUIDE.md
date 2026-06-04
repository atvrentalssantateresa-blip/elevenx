# LP Fee Sharing System - Implementation Guide

## Overview
The LP Fee Sharing system automatically rewards **real LP stakers** (users with `role='lp'` in UserBet) with a share of platform fees when they withdraw winnings from settled markets.

## How It Works

### 1. Fee Pool Generation
When a market settles:
- **Losing bets** are collected in the market pool
- **Platform takes 5% fee** from the losing pool
- **50% of that fee** (2.5% of total losing pool) goes to the LP Incentive Pool
- The other 50% goes to the platform treasury

### 2. LP Bonus Distribution
When an LP withdraws winnings:
1. Backend queries all **losing UserBets** for the market
2. Calculates: `totalPlatformFee = totalLosingPool × 0.05`
3. Calculates: `lpIncentivePool = totalPlatformFee × 0.5`
4. Finds all **winning LPs** (role='lp', outcome=winner, status='won')
5. Distributes lpIncentivePool **proportionally** based on each LP's stake

**Formula:**
```
lpShare = (yourStake / totalWinningLpLiquidity)
lpBonus = lpIncentivePool × lpShare
totalWithdraw = baseWinnings + lpBonus
```

### 3. Key Differentiation
- **Real LPs** (role='lp'): Get base winnings + LP fee bonus
- **Regular Bettors** (role='matcher'): Only get parimutuel pool share (no bonus)
- **Under-the-hood LP** (bettors who provided liquidity indirectly): No bonus

## Implementation Details

### Backend Function: `withdrawLpWinnings`
**Location:** `functions/withdrawLpWinnings.js`

**Changes Made:**
- Added `serviceRole` for database queries
- Calculates losing pool and platform fees
- Distributes LP bonus proportionally
- Returns `lpFeeBonus` and `totalWithdraw` in response

**Key Code:**
```javascript
// Get losing bets for fee calculation
const losingBets = allUserBets.filter(ub => 
  ub.outcome !== bet.winning_outcome && ub.status === 'lost'
);

const totalLosingPool = losingBets.reduce((sum, b) => sum + (b.amount || 0), 0);
const totalPlatformFee = totalLosingPool * 0.05; // 5% fee
const lpIncentivePool = totalPlatformFee * 0.5; // 50% to LPs

// Get winning LPs
const winningLps = allUserBets.filter(ub => 
  ub.outcome === bet.winning_outcome && 
  ub.role === 'lp' &&
  ub.status === 'won'
);

const totalWinningLpLiquidity = winningLps.reduce((sum, ub) => sum + (ub.amount || 0), 0);
const lpShare = (userBet.amount || 0) / totalWinningLpLiquidity;
const lpBonus = lpIncentivePool * lpShare;
```

### Frontend: LP Dashboard
**Location:** `pages/LpDashboard.jsx`

**Changes Made:**
- `withdrawLiquidityMutation` now calls `withdrawLpWinnings` for settled positions
- `pendingTx` includes `lpFeeBonus` and `totalWithdraw`
- `SuccessDialog` displays LP fee bonus breakdown when present

**UI Features:**
- Shows "LP Winnings + Fee Bonus!" title when bonus exists
- Displays breakdown: Base winnings + LP fee bonus = Total
- Visual emphasis on the bonus amount (accent color)

## Example Scenario

**Market:** Mexico vs South Africa
- **Losing Pool (South Africa):** 100 SOL
- **Platform Fee (5%):** 5 SOL
- **LP Incentive Pool (50%):** 2.5 SOL

**Winning LPs (Mexico):**
- LP Alice: 10 SOL stake
- LP Bob: 15 SOL stake
- Total LP Liquidity: 25 SOL

**Distribution:**
- Alice's share: 10/25 = 40%
- Alice's bonus: 2.5 × 0.4 = **1.0 SOL**
- Bob's share: 15/25 = 60%
- Bob's bonus: 2.5 × 0.6 = **1.5 SOL**

**When Alice withdraws:**
- Base winnings: 10 SOL (her matched liquidity)
- LP fee bonus: 1.0 SOL
- **Total: 11.0 SOL**

## Benefits

1. **Incentivizes Explicit LP Staking**: Only users who consciously provide liquidity (role='lp') get bonuses
2. **Passive Yield**: LPs earn fees regardless of match outcome (as long as their side wins)
3. **No Smart Contract Changes**: All logic in backend - works with existing deployed program
4. **Proportional & Fair**: Larger LPs get larger bonus share
5. **Automatic**: No manual claims - bonus included in withdrawal transaction

## Testing Checklist

- [ ] LP provides liquidity on winning outcome
- [ ] Market settles with LP's outcome as winner
- [ ] LP clicks withdraw in LP Dashboard
- [ ] Backend calculates lpBonus correctly
- [ ] Transaction includes base + bonus amount
- [ ] Success dialog shows fee bonus breakdown
- [ ] Database records updated correctly

## Future Enhancements

1. **LP Dashboard Stats**: Show total fees earned across all positions
2. **Fee History**: Track LP bonus earnings per market
3. **Tiered Rewards**: Higher bonus % for larger/longer LP positions
4. **Futures Markets**: Extend fee sharing to futures LPs
5. **Real-time Estimator**: Show potential fee earnings before market settles