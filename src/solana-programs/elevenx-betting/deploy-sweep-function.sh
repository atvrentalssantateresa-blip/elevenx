#!/bin/bash

# Deploy updated program with sweep_market_funds instruction

echo "🚀 Deploying updated ElevenX Betting Program..."
echo ""

cd solana-programs/elevenx-betting

# Build the program
echo "📦 Building program..."
anchor build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful!"
echo ""

# Deploy to devnet
echo "🌐 Deploying to Devnet..."
anchor deploy --provider.cluster devnet

if [ $? -ne 0 ]; then
    echo "❌ Deployment failed!"
    exit 1
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📝 Next steps:"
echo "1. Update the SOLANA_PROGRAM_ID secret with the new program ID"
echo "2. Re-initialize the platform using the Admin Dashboard"
echo "3. Test sweep_market_funds on the settled draw market"
echo ""
echo "Program ID will be shown above - copy it to your .env file:"
echo "SOLANA_PROGRAM_ID=<new_program_id>"