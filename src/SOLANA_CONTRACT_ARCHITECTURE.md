# ElevenX Solana Program Architecture

## Overview

This is the complete Solana/Anchor port of the original Solidity contracts
(`BetMarket.sol`, `FeeVault.sol`, `OracleAdapter.sol`).

---

## Solidity → Solana Mapping

| Solidity Contract | Solana Equivalent |
|---|---|
| `FeeVault.sol` | `state/fee_vault.rs` + `instructions/fees.rs` |
| `BetMarket.sol` | `state/market.rs` + `instructions/market.rs` + `instructions/betting.rs` + `instructions/claims.rs` |
| `OracleAdapter.sol` | `state/oracle_vote.rs` + `instructions/oracle.rs` |
| `BettingFactory` (Clones) | Not needed — Anchor PDAs are deterministic per `match_id` |

---

## Program Instructions

| Instruction | Who calls | Equivalent Solidity |
|---|---|---|
| `initialize_platform` | Admin (once) | Constructor + `FeeVault.constructor` |
| `create_market` | Admin | `BettingFactory.createMarket` |
| `set_market_paused` | Admin | `BetMarket.pause/unpause` |
| `void_market` | Admin | `BetMarket.voidMarket` |
| `place_bet` | Bettor | `BetMarket.placeBet` |
| `submit_oracle_vote` | Oracle signer | `OracleAdapter.settleMarket` (Track A) |
| `emergency_settle` | Admin | `OracleAdapter.emergencySettle` |
| `claim_winnings` | Winner | `BetMarket.claim` |
| `refund` | Bettor (voided markets) | `BetMarket.refund` |
| `withdraw_fees` | Admin | `FeeVault.withdrawFees` |

---

## PDA Addresses

| Account | Seeds |
|---|---|
| `PlatformConfig` | `["platform"]` |
| `FeeVault` | `["fee_vault"]` |
| `BetMarket` | `["market", match_id_32_bytes]` |
| `VoteTally` | `["vote_tally", market_pubkey]` |
| `BetPosition` | `["position", market_pubkey, bettor_pubkey]` |
| `OracleVote` | `["oracle_vote", market_pubkey, oracle_pubkey]` |

---

## Key Design Decisions

### 1. SOL-native (no SPL tokens)
The Solidity contracts used ERC-20 (`betToken`). The Solana version uses
native SOL lamports — simpler, no token accounts needed.
To add USDC support later: swap `system_program::transfer` for SPL token CPI calls.

### 2. Fee Vault = PDA lamport balance
Instead of `IERC20.safeTransfer`, fees are moved via direct lamport manipulation
on the `FeeVault` PDA. The `FeeVault.total_fees` field tracks the accounting.

### 3. Oracle Consensus
Mirrors `OracleAdapter.sol` Track A:
- Each authorized oracle signer calls `submit_oracle_vote`.
- `VoteTally` PDA tracks vote counts per outcome.
- Once votes ≥ `consensus_threshold`, settlement fires automatically.
- Admin `emergency_settle` bypasses consensus (mirrors `emergencySettle`).

### 4. No Factory / Clones needed
Solidity used `Clones` (minimal proxy) to deploy one `BetMarket` per match.
On Solana, PDAs derived from `match_id` give the same deterministic isolation
without deploying new programs.

### 5. Payout formula (identical to Solidity)
```
gross = stake + (stake * losers_pool) / winners_pool
fee   = gross * fee_percent / 10_000
payout = gross - fee
```

---

## Build & Deploy

```bash
cd solana-programs/elevenx-betting

# 1. Build
anchor build

# 2. Get your program ID
solana address -k target/deploy/elevenx_betting-keypair.json

# 3. Update declare_id! in src/lib.rs with the above address
#    Update [programs.devnet] in Anchor.toml

# 4. Rebuild
anchor build

# 5. Deploy
anchor deploy --provider.cluster devnet

# 6. Run tests
anchor test
```

---

## Adding Oracle Signers

Oracle signers are identified by their Solana wallet public key.
The current consensus model is:
- `consensus_threshold` (default 2) oracle wallets must agree.
- Any wallet can call `submit_oracle_vote` — but only votes matching the
  threshold for the same `winning_outcome` will trigger settlement.

To add oracle signers, simply add their public keys to your off-chain
oracle service and have them call `submit_oracle_vote` after match results
are confirmed.

---

## Next Steps

1. Run `anchor test` to verify all 7 tests pass.
2. Deploy to devnet with `anchor deploy`.
3. Update `SOLANA_PROGRAM_ID` in backend functions.
4. (Optional) Add SPL token support for USDC bets.
5. (Optional) Add multi-sig admin via Squads Protocol.