import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Deploy ALL futures markets from database to Solana
 * Returns first transaction instruction for user to sign
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    console.log('[deployAllFutures] Starting deployment...');

    // Get all futures markets
    const allMarkets = await base44.asServiceRole.entities.FuturesMarket.filter({});
    const marketsToDeploy = allMarkets.filter(m => !m.solana_market_created);

    console.log(`[deployAllFutures] Found ${marketsToDeploy.length} markets to deploy out of ${allMarkets.length} total`);

    if (marketsToDeploy.length === 0) {
      return Response.json({ 
        success: true,
        message: 'All futures already deployed',
        total: allMarkets.length,
        deployed: allMarkets.filter(m => m.solana_market_created).length,
      });
    }

    // Deploy first market and return instruction for signing
    const firstMarket = marketsToDeploy[0];
    const remaining = marketsToDeploy.length - 1;

    try {
      const res = await base44.functions.invoke('createFuturesMarketOnChain', {
        futures_market_id: firstMarket.id,
      });

      if (res.data.error) {
        throw new Error(res.data.error);
      }

      // If already exists, skip to next
      if (res.data.alreadyExists) {
        await base44.asServiceRole.entities.FuturesMarket.update(firstMarket.id, {
          solana_market_created: true,
          solana_market_pda: res.data.marketPda || firstMarket.solana_market_pda,
        });
        console.log(`[deployAllFutures] ✓ Already exists: ${firstMarket.country}`);
        
        // Return next market to deploy
        return Response.json({
          success: true,
          message: `Market already deployed. ${remaining} remaining`,
          remaining: remaining,
          needsSigning: false,
          autoContinue: true,
        });
      }

      console.log(`[deployAllFutures] Ready to deploy: ${firstMarket.country}`);

      return Response.json({
        success: true,
        message: `Sign to deploy ${firstMarket.country || firstMarket.title}. ${remaining} remaining after this.`,
        remaining: remaining,
        needsSigning: true,
        solana_instruction: res.data.solana_instruction,
        market_id: firstMarket.id,
      });

    } catch (err) {
      console.error(`[deployAllFutures] ✗ Failed ${firstMarket.id}:`, err);
      return Response.json({
        success: false,
        error: err.message,
        market_id: firstMarket.id,
      });
    }

  } catch (error) {
    console.error('deployAllFutures error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});