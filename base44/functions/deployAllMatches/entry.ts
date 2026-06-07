import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Deploy ALL match markets from database to Solana
 * Returns first transaction instruction for user to sign
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    console.log('[deployAllMatches] Starting deployment...');

    // Get all bets
    const allBets = await base44.asServiceRole.entities.Bet.filter({});
    
    // Find bets that need deployment (not marked as deployed)
    const betsNotMarkedDeployed = allBets.filter(b => !b.solana_market_created);

    console.log(`[deployAllMatches] Found ${betsNotMarkedDeployed.length} bets not marked as deployed out of ${allBets.length} total`);

    // If all are marked deployed, verify on-chain status
    if (betsNotMarkedDeployed.length === 0) {
      console.log('[deployAllMatches] All bets marked deployed, verifying on-chain...');
      let needsRedeployment = false;
      let redeployCount = 0;
      
      for (const bet of allBets) {
        if (bet.solana_market_pda) {
          try {
            // Check if market exists on-chain
            const statusRes = await base44.functions.invoke('checkMarketStatus', {
              bet_id: bet.id,
            });
            
            if (statusRes.data.error || !statusRes.data.exists) {
              console.log(`[deployAllMatches] Market missing on-chain: ${bet.id}`);
              needsRedeployment = true;
              redeployCount++;
              // Mark for redeployment
              await base44.asServiceRole.entities.Bet.update(bet.id, {
                solana_market_created: false,
              });
            }
          } catch (err) {
            console.log(`[deployAllMatches] Failed to verify ${bet.id}:`, err.message);
            needsRedeployment = true;
            redeployCount++;
          }
        }
      }
      
      if (needsRedeployment) {
        console.log(`[deployAllMatches] Found ${redeployCount} markets need redeployment`);
        // Refresh the list after marking missing markets
        const updatedBets = await base44.asServiceRole.entities.Bet.filter({});
        const betsToDeploy = updatedBets.filter(b => !b.solana_market_created);
        // Continue to deploy the first one
        const firstBet = betsToDeploy[0];
        const remaining = betsToDeploy.length - 1;
        
        const res = await base44.functions.invoke('createMarketOnChain', {
          bet_id: firstBet.id,
          force_recreate: true,
        });
        
        if (res.data.error) throw new Error(res.data.error);
        
        return Response.json({
          success: true,
          message: `Found ${redeployCount} markets missing on-chain. Deploying first...`,
          remaining: remaining,
          needsSigning: true,
          solana_instruction: res.data.solana_instruction,
          bet_id: firstBet.id,
        });
      }
      
      return Response.json({ 
        success: true,
        message: `✓ All ${allBets.length} matches verified on-chain`,
        total: allBets.length,
        deployed: allBets.length,
        verified: true,
      });
    }
    
    const betsToDeploy = betsNotMarkedDeployed;

    // Deploy first bet and return instruction for signing
    const firstBet = betsToDeploy[0];
    const remaining = betsToDeploy.length - 1;

    try {
      const res = await base44.functions.invoke('createMarketOnChain', {
        bet_id: firstBet.id,
        force_recreate: false,
      });

      if (res.data.error) {
        throw new Error(res.data.error);
      }

      // If already exists, skip to next
      if (res.data.alreadyExists) {
        await base44.asServiceRole.entities.Bet.update(firstBet.id, {
          solana_market_created: true,
          solana_market_pda: res.data.marketPda || firstBet.solana_market_pda,
        });
        console.log(`[deployAllMatches] ✓ Already exists: ${firstBet.title}`);
        
        // Return next bet to deploy
        return Response.json({
          success: true,
          message: `Market already deployed. ${remaining} remaining`,
          remaining: remaining,
          needsSigning: false,
          autoContinue: true,
        });
      }

      console.log(`[deployAllMatches] Ready to deploy: ${firstBet.title}`);

      return Response.json({
        success: true,
        message: `Sign to deploy ${firstBet.title || firstBet.match_id}. ${remaining} remaining after this.`,
        remaining: remaining,
        needsSigning: true,
        solana_instruction: res.data.solana_instruction,
        bet_id: firstBet.id,
      });

    } catch (err) {
      console.error(`[deployAllMatches] ✗ Failed ${firstBet.id}:`, err);
      return Response.json({
        success: false,
        error: err.message,
        bet_id: firstBet.id,
      });
    }

  } catch (error) {
    console.error('deployAllMatches error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});