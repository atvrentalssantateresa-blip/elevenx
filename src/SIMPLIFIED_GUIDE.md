# ElevenX - Simplified Betting System

## Quick Start Guide

### 1. Platform Setup (One-Time)
- Go to **Admin Panel**
- Click **"Initialize Platform"** - Sign the transaction with your Phantom wallet
- This sets up the fee vault and platform config on Solana

### 2. Create Markets
- Admin panel shows all **Matches**
- Click **"Initialize Market"** on any match
- This creates a betting market with **fixed 2.1 odds** for all outcomes (Team A, Draw, Team B)

### 3. Provide Liquidity (LP)
- Users can click on any market to **provide liquidity**
- Choose an outcome (Team A, Draw, or Team B)
- Enter amount (e.g., 0.1 SOL)
- Sign transaction - your liquidity goes into the pool
- You earn fees when bettors match against your liquidity

### 4. Place Bets
- Bettors click on odds for their chosen outcome
- Enter stake amount
- Sign transaction - bet is matched against LP pool
- If they win, they get paid from the pool
- If they lose, LPs keep their stake

### 5. Settle Markets
- After match ends, Admin goes to **Admin Panel**
- Click winner button (Team A / Draw / Team B)
- System automatically distributes payouts to winners
- LPs get back their share + fees

## Key Changes

✅ **Fixed 2.1 odds** - No complex oracle setup needed
✅ **Simple initialization** - One click to create markets
✅ **Clean admin panel** - Removed complexity
✅ **No manual odds editing** - Everything is standardized

## Flow Summary

```
Admin Creates Market → LPs Add Liquidity → Bettors Place Bets → Match Ends → Admin Settles → Winners Get Paid
```

## Testing Steps

1. **Initialize platform** (Admin)
2. **Create a test market** (Admin)
3. **Provide liquidity** on an outcome (Any user)
4. **Place a bet** against that liquidity (Different user)
5. **Settle the market** with correct winner (Admin)
6. **Claim winnings** (Winner)

## Troubleshooting

- **"Invalid offer" error**: Delete old BetOffer records, create new ones
- **Can't connect wallet**: Clear localStorage, refresh page
- **Transaction fails**: Check Solana devnet has funds, platform is initialized