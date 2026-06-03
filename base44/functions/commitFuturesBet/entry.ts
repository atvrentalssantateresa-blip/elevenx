import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { Connection } from 'npm:@solana/web3.js@1.98.4';

/**
 * Commit futures bet to database AFTER transaction succeeds on-chain.
 * Called by frontend with transaction signature to verify and commit.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const serviceRole = base44.asServiceRole;
    
    const payload = await req.json();
    const { signature, commit_data } = payload;
    
    if (!signature || !commit_data) {
      return Response.json({ error: 'Missing signature or commit_data' }, { status: 400 });
    }
    
    // Verify transaction exists on-chain
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    try {
      const tx = await connection.getTransaction(signature, { commitment: 'confirmed' });
      if (!tx) {
        return Response.json({ error: 'Transaction not found on-chain' }, { status: 400 });
      }
      if (tx.meta?.err) {
        return Response.json({ error: 'Transaction failed on-chain', onChainError: tx.meta.err }, { status: 400 });
      }
      console.log('[commitFuturesBet] Transaction verified on-chain:', signature);
    } catch (err) {
      return Response.json({ error: 'Failed to verify transaction: ' + err.message }, { status: 400 });
    }
    
    // Create UserBet record
    const createdBet = await serviceRole.entities.UserBet.create(commit_data.userBet);
    console.log('[commitFuturesBet] Created UserBet:', createdBet.id);
    
    // Update FuturesMarket outcome pool and totals
    const market = await serviceRole.entities.FuturesMarket.get(commit_data.marketUpdate.market_id);
    if (market && market.outcomes) {
      const outcomeIdx = commit_data.marketUpdate.outcomeIdx;
      if (market.outcomes[outcomeIdx]) {
        market.outcomes[outcomeIdx].pool = (market.outcomes[outcomeIdx].pool || 0) + commit_data.marketUpdate.amount;
        market.outcomes[outcomeIdx].lp_offers = (market.outcomes[outcomeIdx].lp_offers || 0) + 1;
      }
      market.total_volume = (market.total_volume || 0) + commit_data.marketUpdate.amount;
      
      await serviceRole.entities.FuturesMarket.update(commit_data.marketUpdate.market_id, {
        outcomes: market.outcomes,
        total_volume: market.total_volume,
      });
      console.log('[commitFuturesBet] Updated FuturesMarket pools');
    }
    
    return Response.json({
      success: true,
      userBetId: createdBet.id,
      message: `✓ ◎${commit_data.marketUpdate.amount} futures bet committed successfully!`,
    });
    
  } catch (error) {
    console.error('[commitFuturesBet] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});