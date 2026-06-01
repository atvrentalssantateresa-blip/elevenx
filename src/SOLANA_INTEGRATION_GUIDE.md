# ElevenX Solana Smart Contract Integration Guide

## Overview

This guide explains how the ElevenX betting platform integrates Solana smart contracts for decentralized P2P betting with fixed odds.

## Architecture

### Hybrid Model
- **On-Chain**: SOL transfers, escrow management, settlement execution
- **Off-Chain (Base44)**: User management, bet matching, odds calculation, UI/UX

### Key Components

1. **Solana Smart Contract** (`solana-programs/elevenx-betting/`)
   - Manages market escrow accounts
   - Handles SOL transfers for bets and liquidity
   - Executes claims and refunds
   - Enforces platform fees

2. **Base44 Backend Functions** (`/functions/`)
   - `placeBet` - Match bettor against LP liquidity
   - `provideLiquidity` - LP commits funds to outcome
   - `claimWinnings` - Prepare claim instruction
   - `settleBetWithOracle` - Admin settlement
   - `walletAuth` - Wallet-based authentication

3. **Frontend Components**
   - `WalletContext` - Phantom wallet integration
   - `SolanaTransactionSigner` - Transaction UI
   - Betting pages - User interface

## Data Flow

### 1. Placing a Bet

```
User (Frontend)
  ↓
placeBet function (Base44)
  ↓
- Validate bet is open
- Find matching LP offer
- Calculate payout (fixed odds)
- Derive PDAs (market, position)
- Create UserBet record
  ↓
Return Solana instruction
  ↓
User signs via Phantom
  ↓
SOL transferred to market escrow
  ↓
Bet status: "active"
```

### 2. Providing Liquidity

```
LP (Frontend)
  ↓
provideLiquidity function
  ↓
- Validate bet is open
- Derive LP offer PDA
- Create/update BetOffer record
- Update Bet LP totals
  ↓
Return Solana instruction
  ↓
User signs via Phantom
  ↓
SOL transferred to market escrow
  ↓
Offer status: "open"
```

### 3. Claiming Winnings

```
Winner (Frontend)
  ↓
claimWinnings function
  ↓
- Verify bet status = "won"
- Calculate payout (gross - 2% fee)
- Derive PDAs (market, position, fee vault)
  ↓
Return program instruction
  ↓
User signs via Phantom
  ↓
Program transfers SOL from escrow to user
  ↓
Bet status: "claimed"
```

## PDA Derivation

Consistent PDA derivation across all components:

```javascript
// Market PDA (per match)
const [marketPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('market'), matchIdBytes],
  programId
);

// Position PDA (per bettor per market)
const [positionPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('position'), marketPda.toBuffer(), bettorPubkey.toBuffer()],
  programId
);

// LP Offer PDA (per LP per outcome)
const [lpOfferPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('lp_offer'), marketPda.toBuffer(), lpPubkey.toBuffer(), Buffer.from([outcomeIndex])],
  programId
);

// Fee Vault PDA (global)
const [feeVaultPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('fee_vault')],
  programId
);
```

## Entity Relationships

```
Match (1) ──→ (N) Bet
                    │
                    ├─→ (N) BetOffer (LP liquidity)
                    │
                    └─→ (N) UserBet (bettor positions)
```

### Match Entity
- Team names, flags, venue
- Match time, group stage
- Status: upcoming → live → finished
- Score, winner

### Bet Entity
- References match_id
- Outcome labels (A, B, Draw)
- Oracle odds (basis points)
- LP amounts per outcome
- Backed amounts per outcome
- Total pool, fee percent
- Status: open → closed → settled

### BetOffer Entity
- References bet_id, match_id
- Outcome (a, b, draw)
- Amount offered, matched, unmatched
- Status: open → partially_matched → fully_matched
- LP wallet address
- Solana PDAs

### UserBet Entity
- References bet_id, match_id, offer_id
- Role: lp or matcher
- Outcome chosen
- Amount staked
- Potential payout (fixed at bet time)
- Status: pending → active → won/lost → claimed
- Solana position PDA

## Configuration

### Environment Variables

Set in Base44 Dashboard → Settings → Environment Variables:

```bash
SOLANA_PROGRAM_ID=ElevenXProgramID1111111111111111111111111
SOLANA_RPC_URL=https://api.devnet.solana.com
```

### Program ID Updates

After deploying your smart contract, update:

1. **Anchor.toml**
```toml
[programs.devnet]
elevenx_betting = "YOUR_ACTUAL_PROGRAM_ID"
```

2. **src/lib.rs**
```rust
declare_id!("YOUR_ACTUAL_PROGRAM_ID");
```

3. **All backend functions** (or use env var)
```javascript
const SOLANA_PROGRAM_ID = Deno.env.get('SOLANA_PROGRAM_ID') || 'YOUR_ACTUAL_PROGRAM_ID';
```

## Testing Workflow

### 1. Deploy Smart Contract
```bash
cd solana-programs/elevenx-betting
./deploy.sh
```

### 2. Update Configuration
- Copy program ID from deployment output
- Update all configuration files
- Set environment variables in Base44

### 3. Test Betting Flow

**As LP:**
1. Navigate to a bet market
2. Click "Provide Liquidity"
3. Select outcome (A, B, or Draw)
4. Enter amount
5. Sign transaction in Phantom
6. Verify BetOffer created

**As Bettor:**
1. Navigate to a bet market
2. Select outcome
3. Enter stake amount
4. See fixed odds and potential payout
5. Sign transaction in Phantom
6. Verify UserBet created with status "active"

**Settlement:**
1. Admin calls settleBetWithOracle
2. Match result entered
3. UserBets updated: won/lost
4. Winners can claim

**Claim:**
1. Winner navigates to "My Bets"
2. Click "Claim Winnings"
3. Sign transaction
4. SOL received in wallet

## Security Considerations

### Authentication
- Wallet signature verification in `walletAuth`
- User session management via Base44 auth
- Admin-only functions check `user.role === 'admin'`

### Escrow Management
- All SOL locked in market PDA escrow
- Only released via program instructions
- Platform fees automatically deducted

### Oracle Integration
- Manual settlement via admin (current)
- Ready for Pyth/oracle integration
- Emergency settlement available

### Error Handling
- All functions wrapped in try/catch
- Detailed error logging
- User-friendly error messages

## Troubleshooting

### "Wallet not connected"
- Ensure Phantom extension installed
- Connect wallet via UI button
- Check localStorage for session

### "Invalid program ID"
- Verify SOLANA_PROGRAM_ID env var
- Check program deployed to correct network
- Confirm program ID matches in all files

### "Transaction failed"
- Check Solana balance for fees
- Verify market is still open
- Check LP liquidity available

### "Bet not found"
- Verify bet_id exists in database
- Check bet status is "open"
- Confirm match hasn't finished

## Production Deployment

### Pre-Launch Checklist
- [ ] Smart contract audited
- [ ] Deployed to mainnet
- [ ] Program ID updated everywhere
- [ ] Environment variables set
- [ ] Admin settlement flow tested
- [ ] Fee vault configured
- [ ] Emergency procedures documented

### Mainnet Deployment
```bash
solana config set --url mainnet
anchor deploy --provider.cluster mainnet
```

### Post-Deployment
- Monitor transactions via Solana Explorer
- Track fee accumulation
- Prepare for oracle integration
- Set up monitoring/alerts

## Future Enhancements

1. **Oracle Integration**
   - Pyth Network for real-time odds
   - Automated settlement

2. **Advanced Features**
   - Parimutuel pooling option
   - Multi-leg bets
   - Cash-out functionality

3. **Governance**
   - DAO for platform parameters
   - Community-driven odds setting

## Support

For issues or questions:
- Check deployment logs
- Review smart contract tests
- Contact development team
- Consult Solana/Anchor documentation