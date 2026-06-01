#!/bin/bash

# ElevenX Betting - Solana Smart Contract Deployment Script
# This script automates the deployment process to Solana devnet

set -e

echo "🚀 ElevenX Betting - Solana Deployment Script"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v solana &> /dev/null; then
    echo -e "${RED}❌ Solana CLI not found. Please install from https://docs.solana.com/cli/install-solana-cli-tools${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Solana CLI installed${NC}"

if ! command -v anchor &> /dev/null; then
    echo -e "${RED}❌ Anchor CLI not found. Please install with: cargo install --git https://github.com/coral-xyz/anchor avm --force${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Anchor CLI installed${NC}"

# Check if in correct directory
if [ ! -f "Anchor.toml" ]; then
    echo -e "${RED}❌ Not in the correct directory. Please run this script from solana-programs/elevenx-betting/${NC}"
    exit 1
fi

# Get deployment network
echo ""
echo "🌐 Select deployment network:"
echo "1) Devnet (recommended for testing)"
echo "2) Localnet"
read -p "Enter choice (1 or 2): " network_choice

if [ "$network_choice" = "1" ]; then
    CLUSTER="devnet"
    RPC_URL="https://api.devnet.solana.com"
elif [ "$network_choice" = "2" ]; then
    CLUSTER="localnet"
    RPC_URL="http://127.0.0.1:8899"
else
    echo -e "${RED}❌ Invalid choice${NC}"
    exit 1
fi

echo ""
echo "🔧 Configuring Solana CLI for $CLUSTER..."
solana config set --url $CLUSTER

# Check wallet
echo ""
echo "💰 Checking wallet..."
WALLET_PATH=~/.config/solana/id.json
if [ ! -f "$WALLET_PATH" ]; then
    echo -e "${YELLOW}⚠️  Wallet not found. Generating new keypair...${NC}"
    solana-keygen new --outfile $WALLET_PATH
fi

WALLET_ADDRESS=$(solana address)
echo -e "${GREEN}✅ Wallet: $WALLET_ADDRESS${NC}"

# Check balance
BALANCE=$(solana balance --lamports | awk '{print $1}')
if [ "$CLUSTER" = "devnet" ] && [ "$BALANCE" -lt 1000000000 ]; then
    echo -e "${YELLOW}⚠️  Low balance. Requesting devnet SOL...${NC}"
    solana airdrop 2
fi

# Build program
echo ""
echo "🔨 Building program..."
anchor build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build successful${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

# Get program ID
PROGRAM_ID=$(grep -m1 "elevenx_betting = " Anchor.toml | cut -d'"' -f2)
echo ""
echo "📝 Program ID: $PROGRAM_ID"

# Deploy
echo ""
echo "🚀 Deploying to $CLUSTER..."
anchor deploy

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Deployment successful!${NC}"
else
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
fi

# Initialize platform (optional)
echo ""
read -p "Initialize platform now? (y/n): " init_choice

if [ "$init_choice" = "y" ] || [ "$init_choice" = "Y" ]; then
    echo "📊 Initializing platform..."
    read -p "Enter fee percent in basis points (e.g., 200 for 2%): " fee_percent
    fee_percent=${fee_percent:-200}
    
    # This would require running the actual instruction via anchor test or custom script
    echo -e "${YELLOW}⚠️  Platform initialization requires running the initialize_platform instruction.${NC}"
    echo "   You can do this via:"
    echo "   1. Anchor test script"
    echo "   2. Custom admin dashboard"
    echo "   3. Solana CLI with proper instruction data"
fi

# Summary
echo ""
echo "=============================================="
echo "🎉 Deployment Complete!"
echo "=============================================="
echo ""
echo "📝 Program ID: $PROGRAM_ID"
echo "🌐 Network: $CLUSTER"
echo "🔗 RPC URL: $RPC_URL"
echo "💼 Wallet: $WALLET_ADDRESS"
echo ""
echo "⚠️  IMPORTANT: Update the following with your new program ID:"
echo ""
echo "1. Anchor.toml:"
echo "   [programs.$CLUSTER]"
echo "   elevenx_betting = \"$PROGRAM_ID\""
echo ""
echo "2. src/lib.rs:"
echo "   declare_id!(\"$PROGRAM_ID\");"
echo ""
echo "3. Base44 Environment Variables:"
echo "   SOLANA_PROGRAM_ID=$PROGRAM_ID"
echo "   SOLANA_RPC_URL=$RPC_URL"
echo ""
echo "4. Backend Functions (if not using env vars):"
echo "   - functions/placeBet"
echo "   - functions/provideLiquidity"
echo "   - functions/createBetOffer"
echo "   - functions/matchBet"
echo "   - functions/claimWinnings"
echo ""
echo "📖 Next Steps:"
echo "   1. Update all configuration files with program ID"
echo "   2. Initialize platform via initialize_platform instruction"
echo "   3. Test betting flow on $CLUSTER"
echo "   4. Deploy to mainnet when ready"
echo ""
echo "=============================================="