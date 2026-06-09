#!/bin/bash
set -e

echo "=== Deploying sweep_market_funds fix ==="
echo ""

cd "$(dirname "$0")"

# Build the program
echo "🔨 Building program..."
anchor build -- --features no-entrypoint

# Deploy to Devnet
echo "🚀 Deploying to Devnet..."
anchor deploy --provider.cluster devnet

# Get the program ID
PROGRAM_ID=$(grep 'declare_id!' programs/elevenx-betting/src/lib.rs | sed 's/.*declare_id!\("//' | sed 's/".*//')
echo ""
echo "✅ Deployment complete!"
echo "Program ID: $PROGRAM_ID"
echo ""
echo "⚠️  IMPORTANT: Update SOLANA_PROGRAM_ID secret in Base44 Dashboard with this address!"
echo ""