# 🚀 Deployment Guide - Updated Program

## Quick Deploy Checklist

Follow these steps to deploy the updated program with outcome byte support.

---

## Step 1: Navigate to Program Directory

```bash
cd solana-programs/elevenx-betting
```

---

## Step 2: Build the Program

```bash
anchor build
```

**Expected Output:**
```
Compiling elevenx-betting v0.1.0
...
Finished release [optimized] target(s)
```

**What this does:**
- Compiles your Rust smart contract
- Generates the program `.so` file
- Creates/updates the IDL (Interface Definition Language)

---

## Step 3: Deploy to Devnet

```bash
anchor deploy --provider.cluster devnet
```

**Expected Output:**
```
Deploying workspace: devnet
Upgrade authority: <your-wallet-address>
Program Id: <NEW_PROGRAM_ID>
```

**⚠️ IMPORTANT:** Copy the **Program Id** - you'll need it in Step 4!

---

## Step 4: Update Base44 Dashboard

1. Go to your Base44 Dashboard
2. Navigate to **Settings → Secrets**
3. Update `SOLANA_PROGRAM_ID` with the new program ID from Step 3
4. Click **Save**

**Example:**
```
SOLANA_PROGRAM_ID = 8xKj...abc123  (your new program ID)
```

---

## Step 5: Initialize Platform Config

After deploying, you need to initialize the platform config on-chain:

### Option A: Via UI (Recommended)

1. Go to your app's **Admin Dashboard** (`/admin`)
2. Click **"Initialize Platform"**
3. Connect your admin wallet (Phantom)
4. Sign the transaction
5. Wait for confirmation

### Option B: Via Backend Function

Call the `initPlatformConfig` function from Base44 dashboard.

---

## Step 6: Verify Deployment

### Check Program on Solana

```bash
solana program show <YOUR_PROGRAM_ID> --url devnet
```

**Expected Output:**
```
Program Id: <YOUR_PROGRAM_ID>
Slot: <slot-number>
Slot last updated: <timestamp>
```

### Check IDL

```bash
cat target/idl/elevenx_betting.json | jq '.instructions[] | {name: .name, accounts: .accounts | length}'
```

**Expected:** Should show all instructions with correct account counts:
- `place_bet`: 5 accounts
- `claim_winnings`: 5 accounts  
- `refund`: 4 accounts
- `provide_liquidity`: 4 accounts
- `withdraw_liquidity`: 4 accounts

---

## Step 7: Test the Deployment

### Test 1: Place Bets on All 3 Outcomes

1. Go to **Home** page
2. Pick a match (e.g., Haiti vs Scotland)
3. Place ◎0.1 bet on **Haiti** (outcome A)
4. Place ◎0.1 bet on **Scotland** (outcome B)
5. Place ◎0.1 bet on **Draw**

**✅ Expected:** All 3 bets succeed, creating 3 separate BetPosition accounts

### Test 2: Verify on Solscan

1. Go to [Solscan Devnet](https://solscan.io/?cluster=devnet)
2. Search for your **wallet address**
3. Click on **SPL Tokens** or **Program Accounts**
4. Look for **BetPosition** accounts

**✅ Expected:** You should see 3 separate BetPosition accounts with seeds:
- `position,<market-pda>,<your-wallet>,0` (Haiti)
- `position,<market-pda>,<your-wallet>,1` (Scotland)
- `position,<market-pda>,<your-wallet>,2` (Draw)

### Test 3: Claim Winnings

1. Go to **Admin Dashboard**
2. Settle the market (announce winner)
3. Go to **My Bets** page
4. Click **Claim Winnings** on the winning bet

**✅ Expected:** Transaction succeeds, SOL transferred to your wallet

---

## Step 8: Test LP Functionality

### Provide Liquidity

1. Go to **LP Dashboard** (`/lp`)
2. Select a match
3. Provide ◎1 liquidity on Haiti
4. Provide ◎1 liquidity on Scotland
5. Provide ◎1 liquidity on Draw

**✅ Expected:** 3 separate LpOffer accounts created

### Withdraw Unmatched Liquidity

1. Go to **LP Dashboard → My LP**
2. Find your position
3. Click **Withdraw Unmatched**

**✅ Expected:** Withdrawal succeeds for each outcome independently

---

## Troubleshooting

### ❌ Error: "Market already initialized"

**Cause:** Trying to create a market that already exists on-chain.

**Solution:** Use a different `match_id` or delete the old market first.

---

### ❌ Error: "Platform not initialized"

**Cause:** Platform config not deployed yet.

**Solution:** Run Step 5 (Initialize Platform Config).

---

### ❌ Error: "Invalid instruction data or discriminator"

**Cause:** Backend/frontend using old instruction format.

**Solution:** 
- Ensure backend functions include `instruction_data` in response
- Check `claimWinnings.js` and `claimRefund.js` encode outcome byte

---

### ❌ Error: "Account not found"

**Cause:** Trying to access BetPosition with old PDA (without outcome byte).

**Solution:** This is expected for OLD positions. New bets will work correctly.

---

### ❌ Error: "Custom program error: 0"

**Cause:** Betting window closed or market settled.

**Solution:** Check market status and timestamps.

---

## Migration Notes

### ⚠️ Old Positions

**IMPORTANT:** BetPosition accounts created BEFORE this deployment use the OLD PDA structure (without outcome byte).

**Impact:**
- Old positions cannot be accessed with new PDA derivation
- Users cannot claim winnings from old bets

**Solutions:**
1. **Option A (Recommended):** Start fresh on devnet, test thoroughly, then deploy to mainnet
2. **Option B:** Create migration script to transfer old positions to new PDAs (complex)
3. **Option C:** Keep old program for claims only, deploy new program for new bets

---

## Mainnet Deployment

Once tested on devnet:

```bash
# Update Anchor.toml for mainnet
[provider]
cluster = "mainnet"

# Deploy to mainnet
anchor deploy --provider.cluster mainnet

# Update SOLANA_PROGRAM_ID in Base44 dashboard
```

**⚠️ WARNING:** Mainnet deployment is irreversible. Test thoroughly on devnet first!

---

## Post-Deployment Checklist

- [ ] Program deployed to devnet
- [ ] SOLANA_PROGRAM_ID updated in Base44 dashboard
- [ ] Platform config initialized
- [ ] Test: Place bet on outcome A
- [ ] Test: Place bet on outcome B (same wallet)
- [ ] Test: Place bet on Draw (same wallet)
- [ ] Verify: 3 separate BetPosition accounts on Solscan
- [ ] Test: Settle market
- [ ] Test: Claim winnings from winning outcome
- [ ] Test: LP provide liquidity on all 3 outcomes
- [ ] Test: LP withdraw unmatched from each outcome
- [ ] Test: Void market → claim refunds

---

## Support

If you encounter issues:

1. Check runtime logs in Base44 dashboard
2. Verify program ID matches in:
   - Backend functions (`functions/*.js`)
   - Frontend components
   - Base44 secrets
3. Check Solscan for transaction details
4. Review error messages in browser console

---

**🎉 Ready to deploy! Start with Step 1.**