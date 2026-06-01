# Solana Smart Contract Configuration

## Program ID
**Devnet**: `ElevenXProgramID1111111111111111111111111` (placeholder - update after deployment)
**Mainnet**: TBD (deploy after devnet testing)

## Environment Variables

Set these in your Base44 dashboard → Settings → Environment Variables:

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
solana-keygen new --outfile ~/.config/solana/elevenx-betting-keypair.json
```

### 3. Update Anchor.toml
Replace the program ID in `Anchor.toml` and `src/lib.rs` with your generated keypair's public key.

### 4. Deploy to Devnet
```bash
solana config set --url devnet
anchor deploy
```

### 5. Initialize Platform
After deployment, call the `initialize_platform` instruction with your admin wallet.

### 6. Update Backend Functions
Update `SOLANA_PROGRAM_ID` in all backend functions:
- `functions/placeBet`
- `functions/provideLiquidity`
- `functions/createBetOffer`
- `functions/matchBet`
- `functions/claimWinnings`

## Backend Functions Integration

All backend functions are configured to:
1. Use environment variable `SOLANA_PROGRAM_ID`
2. Fallback to placeholder if not set
3. Generate proper PDAs for markets, positions, and offers

## Frontend Integration

The `SolanaTransactionSigner` component handles:
- **place_bet**: Transfer SOL from user to market PDA
- **provide_liquidity**: Transfer SOL from LP to market PDA
- **match_bet**: Transfer SOL from matcher to market PDA
- **claim_winnings**: Program instruction to claim from settled market

## Testing

1. Connect Phantom wallet
2. Create a bet market (admin only)
3. Provide liquidity as LP
4. Place bet as bettor
5. Settle bet (admin or oracle)
6. Claim winnings

## Security Notes

- Program ID must be updated in ALL files after deployment
- Test thoroughly on devnet before mainnet
- Admin functions require role verification
- Oracle integration ready but not yet enabled