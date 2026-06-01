# ElevenX Solana Smart Contract - Integration Complete ✅

## Overview
The ElevenX betting platform smart contract has been fully integrated with the Base44 backend. The system uses a **hybrid fixed-odds model** where:
- Odds are set by oracles at market creation
- LPs provide liquidity for specific outcomes
- Bettors match against LP liquidity at fixed odds
- All transactions are recorded on-chain via Solana

---

## Smart Contract Architecture

### Program Structure
```
solana-programs/elevenx-betting/
├── programs/elevenx-betting/
│   ├── src/
│   │   ├── lib.rs              # Main program entry point
│   │   ├── errors.rs           # Custom error codes
│   │   ├── instructions/       # Instruction handlers
│   │   │   ├── platform.rs     # Platform initialization
│   │   │   ├── market.rs       # Market lifecycle
│   │   │   ├── betting.rs      # Place/match bets
│   │   │   ├── liquidity.rs    # LP operations
│   │   │   ├── oracle.rs       # Oracle voting
│   │   │   ├── claims.rs       # Claim winnings
│   │   │   └── fees.rs         # Fee management
│   │   └── state/              # Account structures
│   │       ├── platform.rs     # Global config
│   │       ├── market.rs       # Bet market state
│   │       ├── bet_position.rs # Bettor positions
│   │       ├── lp_offer.rs     # LP offers
│   │       ├── oracle_vote.rs  # Oracle votes
│   │       └── fee_vault.rs    # Fee collection
│   │── Cargo.toml
├── Anchor.toml                 # Anchor config
├── tests/                      # Integration tests
└── scripts/                    # Deployment scripts
```

### Key Instructions
1. **`initialize_platform`** - Setup fee vault and admin
2. **`create_market`** - Create betting market for a match
3. **`provide_liquidity`** - LP deposits SOL for specific outcome
4. **`place_bet`** - Bettor places bet at fixed odds
5. **`submit_oracle_vote`** - Oracle submits match result
6. **`claim_winnings`** - Winner claims payout
7. **`refund`** - Refund if market voided
8. **`withdraw_fees`** - Admin withdraws fees

---

## Backend Functions Integration

All backend functions are configured and ready:

### Core Betting Functions
| Function | Purpose | Status |
|----------|---------|--------|
| `placeBet` | Place bet matched against LP liquidity | ✅ Configured |
| `provideLiquidity` | LP provides liquidity for outcome | ✅ Configured |
| `createBetOffer` | Create LP offer (alternative flow) | ✅ Configured |
| `matchBet` | Match existing LP offer | ✅ Configured |
| `claimWinnings` | Prepare claim instruction for winners | ✅ Configured |

### Settlement Functions
| Function | Purpose | Status |
|----------|---------|--------|
| `settleBetWithOracle` | Admin settles bet market | ✅ Configured |
| `announceWinner` | Alternative settlement endpoint | ✅ Ready |
| `oracleService` | Fetch odds/results from external providers | ✅ Ready |

### User Functions
| Function | Purpose | Status |
|----------|---------|--------|
| `saveWalletAddress` | Link wallet to user profile | ✅ Ready |
| `walletAuth` | Authenticate via wallet signature | ✅ Ready |

---

## Configuration Files Updated

### 1. `Anchor.toml`
```toml
[programs.devnet]
elevenx_betting = "ElevenXProgramID1111111111111111111111111"
```
**Action Required**: Replace with actual program ID after `anchor deploy`

### 2. `src/lib.rs`
```rust
declare_id!("ElevenXProgramID1111111111111111111111111");
```
**Action Required**: Replace with actual program ID after deployment

### 3. Backend Functions
All functions now use:
```javascript
const SOLANA_PROGRAM_ID = Deno.env.get('SOLANA_PROGRAM_ID') || 'ElevenXProgramID1111111111111111111111111';
```

---

## Environment Variables

Set in Base44 Dashboard → Settings → Environment Variables:

```bash
SOLANA_PROGRAM_ID=ElevenXProgramID1111111111111111111111111
SOLANA_RPC_URL=https://api.devnet.solana.com
```

---

## Frontend Integration

### Wallet Context (`lib/WalletContext.jsx`)
- ✅ Phantom wallet integration
- ✅ Session persistence
- ✅ Account change listeners
- ✅ Auto-save to user profile

### Transaction Signer (`components/wallet/SolanaTransactionSigner.jsx`)
Handles all instruction types:
- ✅ **place_bet**: Transfer SOL to market PDA
- ✅ **provide_liquidity**: Transfer SOL to market PDA
- ✅ **match_bet**: Transfer SOL to market PDA
- ✅ **claim_winnings**: Program instruction with proper keys

---

## Entity Schema Integration

### Bet Entity
- Oracle odds stored in basis points (e.g., 210 = 2.10x)
- Tracks LP amounts per outcome: `lp_amount_a`, `lp_amount_b`, `lp_amount_draw`
- Tracks bettor amounts: `backed_amount_a`, `backed_amount_b`, `backed_amount_draw`
- Status: `open` → `closed` → `settled`

### BetOffer Entity
- LP offers with outcome-specific liquidity
- Tracks matched vs unmatched amounts
- PDA references for on-chain verification

### UserBet Entity
- Records user's bet (both LP and bettor roles)
- Status: `pending` → `active` → `won`/`lost`/`refunded`
- Stores potential and actual payouts

---

## Deployment Checklist

### Pre-Deployment
- [ ] Install Solana CLI and Anchor
- [ ] Fund deployment wallet with devnet SOL
- [ ] Review and test all instruction handlers

### Deploy to Devnet
```bash
cd solana-programs/elevenx-betting
solana config set --url devnet
anchor build
anchor deploy
```

### Post-Deployment
- [ ] Copy deployed program ID from output
- [ ] Update `Anchor.toml` with new program ID
- [ ] Update `src/lib.rs` with new program ID
- [ ] Update all backend functions (or set env var)
- [ ] Update `SOLANA_PROGRAM_ID` in Base44 environment variables
- [ ] Initialize platform via `initialize_platform` instruction
- [ ] Test end-to-end flow on devnet

### Mainnet Deployment
- [ ] Complete devnet testing
- [ ] Security audit recommended
- [ ] Deploy to mainnet following same steps
- [ ] Update all configs to mainnet program ID

---

## Testing Flow

1. **Create Market** (Admin)
   - Call `create_market` with match details
   - Set oracle odds for each outcome

2. **Provide Liquidity** (LP)
   - LP calls `provideLiquidity` backend function
   - Signs transaction to transfer SOL to market PDA
   - BetOffer entity created/updated

3. **Place Bet** (Bettor)
   - Bettor calls `placeBet` backend function
   - Matches against available LP liquidity
   - Signs transaction to transfer SOL
   - UserBet entity created with status `active`

4. **Settle Market** (Admin/Oracle)
   - Call `settleBetWithOracle` with match result
   - Updates all UserBets to `won`/`lost`
   - Updates Bet status to `settled`

5. **Claim Winnings** (Winner)
   - Winner calls `claimWinnings` backend function
   - Signs claim transaction
   - Program transfers payout from market PDA to winner

---

## Security Considerations

### Access Control
- ✅ Admin-only functions check `user.role === 'admin'`
- ✅ Users can only claim their own winnings
- ✅ LP can only withdraw their own liquidity

### PDA Derivation
- Consistent PDA seeds across backend and contract
- Market PDA: `["market", match_id_bytes]`
- Position PDA: `["position", market_pda, bettor_pubkey]`
- LP Offer PDA: `["lp_offer", market_pda, lp_pubkey, outcome_index]`

### Error Handling
- All backend functions wrapped in try/catch
- Proper HTTP status codes returned
- Detailed error logging for debugging

---

## Known Limitations

1. **Oracle Integration**: Ready but not yet connected to live provider
   - `oracleService` function prepared for The Odds API / Pyth integration
   
2. **Program ID**: Currently using placeholder
   - Must be updated after actual deployment

3. **Fee Vault**: Implemented but not yet wired to external withdrawal
   - Admin can call `withdraw_fees` instruction

---

## Next Steps

1. **Deploy to Devnet**
   ```bash
   anchor deploy --provider.cluster devnet
   ```

2. **Update Program ID** in all files

3. **Test End-to-End** on devnet with real transactions

4. **Enable Oracle** integration with live sports data provider

5. **Deploy to Mainnet** after successful devnet testing

---

## Support & Documentation

- **Solana Docs**: https://docs.solana.com
- **Anchor Docs**: https://www.anchor-lang.com
- **Phantom Wallet**: https://phantom.app
- **Base44 Platform**: Dashboard → Code → Functions

---

**Status**: ✅ Integration Complete - Ready for Deployment
**Last Updated**: 2026-06-01