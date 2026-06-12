import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify admin access
    let isAdmin = false;
    try {
      const user = await base44.auth.me();
      if (user && user.role === 'admin') isAdmin = true;
    } catch (_) {}
    
    if (!isAdmin) {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }
    
    // Count all entities
    const allBets = await base44.asServiceRole.entities.Bet.filter({});
    const allMatches = await base44.asServiceRole.entities.Match.filter({});
    
    console.log(`[debugBetCount] Total Bets: ${allBets.length}`);
    console.log(`[debugBetCount] Total Matches: ${allMatches.length}`);
    
    // Check for bets without matching matches
    const matchIds = new Set(allMatches.map(m => m.id));
    const orphanBets = allBets.filter(b => !matchIds.has(b.match_id));
    
    console.log(`[debugBetCount] Orphan Bets (no match): ${orphanBets.length}`);
    
    // Check for matches without bets
    const betMatchIds = new Set(allBets.map(b => b.match_id));
    const matchesWithoutBets = allMatches.filter(m => !betMatchIds.has(m.id));
    
    console.log(`[debugBetCount] Matches without Bets: ${matchesWithoutBets.length}`);
    
    // Check deployment status
    const deployedBets = allBets.filter(b => b.solana_market_created);
    const notDeployedBets = allBets.filter(b => !b.solana_market_created);
    
    console.log(`[debugBetCount] Deployed Bets: ${deployedBets.length}`);
    console.log(`[debugBetCount] Not Deployed Bets: ${notDeployedBets.length}`);
    
    return Response.json({
      success: true,
      totalBets: allBets.length,
      totalMatches: allMatches.length,
      orphanBets: orphanBets.length,
      matchesWithoutBets: matchesWithoutBets.length,
      deployedBets: deployedBets.length,
      notDeployedBets: notDeployedBets.length,
      orphanBetIds: orphanBets.map(b => b.id),
      matchesWithoutBetIds: matchesWithoutBets.map(m => m.id),
    });
    
  } catch (error) {
    console.error('debugBetCount error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});