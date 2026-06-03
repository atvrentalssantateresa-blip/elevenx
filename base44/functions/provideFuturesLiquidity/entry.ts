import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Provides liquidity for futures markets (tournament winners, player awards).
// LP bets AGAINST a specific outcome (e.g., against Brazil winning World Cup).
// Admin-only function.

const PROGRAM_ID = '4epUYJPwoPhG9RPoQ6qT9dsAewJCDBSCGUpR1Xj9UxTm';
const RPC_URL = 'https://api.devnet.solana.com';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { walletAddress, market_id, outcome_label, outcome_flag, odds, amount } = await req.json();

    if (!walletAddress || !market_id || !outcome_label || !odds || !amount) {
      return Response.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Fetch futures market
    const market = await base44.entities.FuturesMarket.get(market_id);
    if (!market) {
      return Response.json({ error: 'Futures market not found' }, { status: 404 });
    }

    if (market.status !== 'open') {
      return Response.json({ error: 'Market is not open for liquidity' }, { status: 400 });
    }

    // Find the outcome in the market
    const outcome = market.outcomes?.find(o => o.label === outcome_label);
    if (!outcome) {
      return Response.json({ error: 'Outcome not found in market' }, { status: 404 });
    }

    // Convert amount to lamports (1 SOL = 1e9 lamports)
    const amountLamports = Math.floor(amount * 1e9);

    // Generate PDA for the futures LP position
    // Use market_id and walletAddress as seeds
    const marketSeed = new TextEncoder().encode(`futures:${market_id}`);
    const walletSeed = new TextEncoder().encode(walletAddress);
    
    // Simple hash for PDA (in production, use proper derivePDA)
    const hashBuffer = await crypto.subtle.digest('SHA-256', new Uint8Array([...marketSeed, ...walletSeed]));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const pdaSeed = hashArray.slice(0, 32).join('');
    
    const lpOfferPda = `LP_${pdaSeed}_${outcome_label.replace(/\s/g, '_')}`;

    // Create UserBet record for LP
    const userBet = await base44.entities.UserBet.create({
      bet_id: market_id, // Use market_id as bet_id for futures
      match_id: market_id,
      offer_id: lpOfferPda,
      role: 'lp',
      outcome: 'a', // Simplified for futures
      amount: amount,
      potential_payout: amount * odds, // LP receives stake * odds if outcome wins
      status: 'pending',
      outcome_label: outcome_label,
      match_title: market.title,
      wallet_address: walletAddress,
    });

    // Build Solana instruction for provide_liquidity
    // This is a simplified version - in production, use proper Anchor instruction encoding
    const instruction = {
      instruction_type: 'provide_futures_liquidity',
      programId: PROGRAM_ID,
      marketPda: `FUTURES_${market_id}`,
      lpOfferPda: lpOfferPda,
      amountLamports: amountLamports,
      outcome: 0, // Simplified
      accounts: {
        market: `FUTURES_${market_id}`,
        lpOffer: lpOfferPda,
        lp: walletAddress,
      },
      instruction_data: btoa(JSON.stringify({
        market_id,
        outcome_label,
        odds,
        amount,
        wallet: walletAddress,
      })),
    };

    return Response.json({
      success: true,
      solana_instruction: instruction,
      commit_data: {
        userBetId: userBet.id,
        offerId: lpOfferPda,
        market_id,
        outcome_label,
        amount,
        odds,
        walletAddress,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});