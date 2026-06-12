import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Admin auth check
    let isAdmin = false;
    try {
      const user = await base44.auth.me();
      if (user && user.role === 'admin') isAdmin = true;
    } catch (_) {}

    if (!isAdmin) {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    console.log('[syncBetsToMatches] Starting sync...');
    
    // Get all matches and bets
    const allMatches = await base44.asServiceRole.entities.Match.filter({});
    const allBets = await base44.asServiceRole.entities.Bet.filter({});
    
    console.log(`[syncBetsToMatches] Total matches: ${allMatches.length}, Total bets: ${allBets.length}`);
    
    // Create match ID set from existing bets
    const betMatchIds = new Set(allBets.map(b => b.match_id));
    
    // Find matches without bets
    const matchesWithoutBets = allMatches.filter(m => !betMatchIds.has(m.id));
    
    console.log(`[syncBetsToMatches] Matches without bets: ${matchesWithoutBets.length}`);
    
    // Create Bet records for matches without them
    const newBets = [];
    const batchSize = 20;
    
    for (let i = 0; i < matchesWithoutBets.length; i += batchSize) {
      const batch = matchesWithoutBets.slice(i, i + batchSize);
      
      const batchBets = batch.map(m => ({
        match_id: m.id,
        title: `${m.team_a} vs ${m.team_b}`,
        outcome_a: m.team_a,
        outcome_b: m.team_b,
        outcome_draw: 'Draw',
        status: 'open',
        odds_a: 0,
        odds_b: 0,
        odds_draw: 0,
        odds_bookmaker: '',
        pool_a: 0,
        pool_b: 0,
        pool_draw: 0,
        total_pool: 0,
        fee_percent: 0,
        total_bettors: 0,
        solana_market_created: false,
        solana_market_pda: null,
        winning_outcome: '',
      }));
      
      await base44.asServiceRole.entities.Bet.bulkCreate(batchBets);
      newBets.push(...batchBets);
      
      console.log(`[syncBetsToMatches] Created ${batchBets.length} bets (batch ${Math.floor(i/batchSize) + 1})`);
      
      // Small delay to avoid rate limits
      if (i + batchSize < matchesWithoutBets.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    console.log(`[syncBetsToMatches] ✓ Created ${newBets.length} new Bet records`);
    
    return Response.json({
      success: true,
      message: `✓ Created ${newBets.length} Bet records for matches without bets`,
      total_matches: allMatches.length,
      total_bets_before: allBets.length,
      total_bets_after: allBets.length + newBets.length,
      new_bets_created: newBets.length,
    });
    
  } catch (error) {
    console.error('syncBetsToMatches error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});