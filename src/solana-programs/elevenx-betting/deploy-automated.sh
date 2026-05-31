#!/bin/bash

echo "🚀 ElevenX Betting Program - Automated Deployment"
echo "================================================"
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v solana &> /dev/null; then
    echo "❌ Solana CLI not found. Install: sh -c \"\$(curl -sSfL https://release.anza.xyz/stable/install)\""
    exit 1
fi
echo "✓ Solana CLI installed"

if ! command -v anchor &> /dev/null; then
    echo "❌ Anchor CLI not found. Install: cargo install --git https://github.com/coral-xyz/anchor avm --locked"
    exit 1
fi
echo "✓ Anchor CLI installed"

echo ""
echo "📡 Configuring for Devnet..."
solana config set --url devnet
echo "✓ Cluster set to devnet"

echo ""
echo "🔑 Generating new program keypair..."
solana-keygen new --outfile keypair.json --no-passphrase
PROGRAM_ID=$(solana pubkey keypair.json)
echo "✓ Program ID: $PROGRAM_ID"
echo ""
echo "⚠️  COPY THIS PROGRAM ID - you'll need it for the backend functions!"
echo ""

echo ""
echo "📝 Updating program ID in source files..."

# Update lib.rs
if [ -f "programs/elevenx-betting/src/lib.rs" ]; then
    sed -i.bak "s/declare_id!(\".*\");/declare_id!(\"$PROGRAM_ID\");/" programs/elevenx-betting/src/lib.rs
    echo "✓ Updated lib.rs"
else
    echo "❌ lib.rs not found"
    exit 1
fi

# Update Anchor.toml
if [ -f "Anchor.toml" ]; then
    sed -i.bak "s/elevenx_betting = \".*\"/elevenx_betting = \"$PROGRAM_ID\"/" Anchor.toml
    echo "✓ Updated Anchor.toml"
else
    echo "❌ Anchor.toml not found"
    exit 1
fi

echo ""
echo "🔨 Building program..."
anchor build
if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi
echo "✓ Build successful"

echo ""
echo "📤 Deploying to Devnet..."
solana deploy keypair.json target/deploy/elevenx_betting.so
if [ $? -ne 0 ]; then
    echo "❌ Deployment failed"
    exit 1
fi

echo ""
echo "✅ Deployment successful!"
echo ""
echo "🎯 Program deployed to: $PROGRAM_ID"
echo ""
echo "📝 Next steps:"
echo "1. Update backend functions with your program ID:"
echo "   - functions/createBetOffer.js"
echo "   - functions/matchBet.js"
echo "   - functions/claimWinnings.js"
echo "   - functions/announceWinner.js"
echo ""
echo "   Replace SOLANA_PROGRAM_ID with: $PROGRAM_ID"
echo ""
echo "2. Test the complete flow in your app"
echo ""
echo "🎉 Done!"