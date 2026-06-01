# Solana Program Deployment Configuration

## Program ID
**Devnet**: `ElevenXProgramID1111111111111111111111111`
**Mainnet**: (To be generated during mainnet deployment)

## Environment Variables
Set these in your Base44 Dashboard → Settings → Environment Variables:

```
SOLANA_PROGRAM_ID=ElevenXProgramID1111111111111111111111111
SOLANA_RPC_URL=https://api.devnet.solana.com
```

## Deployment Steps

### 1. Build the Program
```bash
cd solana-programs/elevenx-betting
anchor build
```

### 2. Generate Program ID (if not already done)
```bash
solana-keygen grind --starts-with 11:1
```

### 3. Deploy to Devnet
```bash
solana config set --url devnet
solana config set --keypair ~/.config/solana/id.json
anchor deploy --provider.cluster devnet
```

### 4. Update Program ID
After deployment, update these files with your actual program ID:
- `Anchor.toml`
- `src/lib.rs`
- All backend functions in `/functions` folder
- This README

### 5. Verify Deployment
```bash
solana program show <YOUR_PROGRAM_ID>
```

## Backend Functions Integration

All backend functions are configured to use the `SOLANA_PROGRAM_ID` environment variable.

### Available Functions:
1. **placeBet** - Bettor places fixed-odds bet
2. **provideLiquidity** - LP provides liquidity for outcome
3. **createBetOffer** - Create LP offer (alternative flow)
4. **matchBet** - Match existing LP offer
5. **claimWinnings** - Winner claims payout
6. **settleBetWithOracle** - Admin settles market
7. **announceWinner** - Alternative settlement function
8. **walletAuth** - Wallet-based authentication
9. **saveWalletAddress** - Save wallet to user profile
10. **oracleService** - Oracle price/outcome fetching

## Frontend Integration

### Wallet Connection
- Uses Phantom wallet via `WalletContext`
- Session persisted in localStorage
- Auto-reconnects on page reload

### Transaction Signing
- `SolanaTransactionSigner` component handles all instruction types:
  - `place_bet` - Transfer SOL to market escrow
  - `provide_liquidity` - Transfer SOL to market escrow
  - `claim_winnings` - Program instruction for payout
  - `match_bet` - Transfer SOL to match offer

### PDA Derivation
All PDAs are derived consistently across backend and frontend:
- **Market PDA**: `["market", match_id_bytes]`
- **Position PDA**: `["position", market_pda, bettor_pubkey]`
- **LP Offer PDA**: `["lp_offer", market_pda, lp_pubkey, outcome_index]`
- **Fee Vault PDA**: `["fee_vault"]`

## Testing Checklist

- [ ] Program deployed to devnet
- [ ] Environment variables set in Base44
- [ ] Backend functions updated with program ID
- [ ] Wallet connection working
- [ ] Place bet transaction signs correctly
- [ ] Provide liquidity transaction signs correctly
- [ ] Claim winnings transaction signs correctly
- [ ] Settlement flow tested end-to-end

## Production Deployment

For mainnet deployment:
1. Generate new program ID for mainnet
2. Update all references to use mainnet cluster
3. Deploy using `--provider.cluster mainnet`
4. Update RPC URL to mainnet endpoint
5. Consider multi-sig for admin functions