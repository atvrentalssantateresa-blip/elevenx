# ElevenX Smart Contract - Quick Reference

## Program Information

**Current Program ID**: `ElevenXProgramID1111111111111111111111111` (placeholder - update after deployment)

**Network**: Solana Devnet (testing) → Mainnet (production)

## Quick Start

### 1. Deploy Smart Contract
```bash
cd solana-programs/elevenx-betting
./deploy.sh
```

### 2. Update Program ID
Replace `ElevenXProgramID1111111111111111111111111` with your actual deployed program ID in:
- `Anchor.toml`
- `src/lib.rs`
- Base44 Environment Variables (Dashboard → Settings)

### 3. Test Integration
1. Connect Phantom wallet
2. Provide liquidity as LP
3. Place bet as bettor
4. Settle match (admin)
5. Claim winnings

## Backend Functions Reference

| Function | Purpose | Key Parameters |
|----------|---------|----------------|
| `placeBet` | Place fixed-odds bet | walletAddress, bet_id, outcome, amount |
| `provideLiquidity` | LP provides funds | walletAddress, bet_id, outcome, amount |
| `createBetOffer` | Create LP offer | walletAddress, bet_id, outcome, amount |
| `matchBet` | Match existing offer | walletAddress, offer_id, amount |
| `claimWinnings` | Claim won bet | userBetId |
| `settleBetWithOracle` | Admin settlement | matchId, result |
| `announceWinner` | Alternative settlement | bet_id, winning_outcome |
| `walletAuth` | Wallet authentication | walletAddress, signature, message |
| `saveWalletAddress` | Save wallet to profile | walletAddress |
| `oracleService` | Fetch odds/results | matchId, provider |

## Smart Contract Instructions

| Instruction | Discriminant | Purpose |
|-------------|-------------|---------|
| `initialize_platform` | 0 | Setup platform with fee vault |
| `create_market` | 1 | Create betting market for match |
| `provide_liquidity` | 2 | LP deposits SOL for outcome |
| `withdraw_liquidity` | 3 | LP withdraws unmatched funds |
| `place_bet` | 4 | Bettor places fixed-odds bet |
| `submit_oracle_vote` | 5 | Oracle submits result vote |
| `claim_winnings` | 6 | Winner claims payout |
| `refund` | 7 | Refund if market voided |
| `withdraw_fees` | 8 | Admin withdraws fees |
| `set_market_paused` | 9 | Pause/unpause market |
| `void_market` | 10 | Void market (admin) |
| `emergency_settle` | 11 | Emergency settlement |

## PDA Seeds

```javascript
// Market (per match)
["market", match_id_bytes]

// Position (per bettor per market)
["position", market_pda, bettor_pubkey]

// LP Offer (per LP per outcome)
["lp_offer", market_pda, lp_pubkey, outcome_index]

// Fee Vault (global)
["fee_vault"]

// Platform (global)
["platform"]

// Oracle Vote (per oracle per market)
["oracle_vote", market_pda, oracle_pubkey]
```

## Outcome Mapping

```javascript
// 3-outcome markets (football)
0 → Team A (Home)
1 → Draw
2 → Team B (Away)

// 2-outcome markets (tennis, basketball)
0 → Player/Team A
1 → Player/Team B
// (no draw option)
```

## Status Enums

### Bet Status
- `open` - Accepting bets
- `closed` - Betting closed, awaiting result
- `settled` - Result submitted, payouts calculated
- `void` - Market cancelled, refunds enabled

### UserBet Status
- `pending` - Unmatched LP offer
- `active` - Matched and locked
- `won` - Winning bet, ready to claim
- `lost` - Losing bet
- `claimed` - Payout collected
- `refunded` - Stake returned (voided market)

### BetOffer Status
- `open` - Fully available
- `partially_matched` - Some liquidity matched
- `fully_matched` - All liquidity matched
- `cancelled` - LP cancelled offer
- `settled` - Market settled

## Fees

**Platform Fee**: 2% (200 basis points) on winnings
- Deducted automatically at claim time
- Accumulates in fee vault
- Withdrawable by admin

**LP Fee**: 0% (currently decentralized)
- LPs provide liquidity at oracle odds
- Risk: losing if outcome they backed wins
- Reward: keeping bettor stakes if outcome loses

## Key Constants

```javascript
// Basis points conversion
100 bps = 1%
200 bps = 2% (platform fee)
10000 bps = 100%

// SOL conversion
1 SOL = 1,000,000,000 lamports

// Timestamps
openUntil - settleAfter (must be > 10 minutes)
```

## Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Wallet not connected" | Phantom not installed/connected | Install Phantom, connect wallet |
| "Bet not open" | Market closed or settled | Check bet status before betting |
| "Insufficient liquidity" | No LP for chosen outcome | Wait for LP or provide yourself |
| "Transaction failed" | Network congestion, low balance | Increase priority fee, check balance |
| "Not authorized" | Non-admin calling admin function | Check user role |
| "Invalid program ID" | Program ID mismatch | Update all config files |

## Testing Commands

```bash
# Check program deployment
solana program show <PROGRAM_ID>

# Check account balance
solana balance

# Request devnet SOL
solana airdrop 2

# View transaction
solana confirm <SIGNATURE>

# Run tests
anchor test

# Build program
anchor build

# Deploy
anchor deploy
```

## Monitoring

### Solana Explorer
- Devnet: https://explorer.solana.com/?cluster=devnet
- Mainnet: https://explorer.solana.com

### Track
- Program transactions
- Market PDAs
- User positions
- Fee vault balance

## Deployment Checklist

### Pre-Deployment
- [ ] Smart contract audited
- [ ] Tests passing
- [ ] Program ID generated
- [ ] Wallet funded (for deployment fees)

### Deployment
- [ ] Deploy to devnet
- [ ] Verify on-chain
- [ ] Update config files
- [ ] Set environment variables

### Post-Deployment
- [ ] Initialize platform
- [ ] Create test market
- [ ] Test full flow
- [ ] Document program ID

### Production
- [ ] Deploy to mainnet
- [ ] Update all references
- [ ] Monitor transactions
- [ ] Setup alerts

## Support Links

- **Anchor Docs**: https://www.anchor-lang.com/docs
- **Solana Docs**: https://docs.solana.com
- **Phantom**: https://phantom.app
- **Solana Explorer**: https://explorer.solana.com
- **Base44 Docs**: Check Base44 dashboard

## Contact

For issues or questions about the integration, refer to:
- `SOLANA_INTEGRATION_GUIDE.md` - Detailed integration guide
- `SOLANA_DEPLOYMENT_CONFIG.md` - Deployment configuration
- `DEPLOYMENT_GUIDE.md` - Full deployment steps
- Smart contract source code in `solana-programs/elevenx-betting/