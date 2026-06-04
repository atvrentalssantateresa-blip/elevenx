import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Admin-only function to update all bets with proper open_until timestamps
// Sets open_until = match_time + 1 hour (traditional bookie style)
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Fetch all bets and matches
    const bets = await base44.asServiceRole.entities.Bet.list();
    const matches = await base44.asServiceRole.entities.Match.list();
    
    // Create a map for quick match lookup
    const matchMap = {};
    matches.forEach(m => { matchMap[m.id] = m; });
    
    let updated = 0;
    let errors = 0;
    
    for (const bet of bets) {
      if (!bet.match_id) {
        errors++;
        continue;
      }
      
      const match = matchMap[bet.match_id];
      if (!match || !match.match_time) {
        errors++;
        continue;
      }
      
      // Calculate open_until = match_time + 1 hour
      const matchTime = new Date(match.match_time);
      const openUntil = new Date(matchTime.getTime() + 60 * 60 * 1000); // +1 hour
      
      await base44.asServiceRole.entities.Bet.update(bet.id, {
        open_until: openUntil.toISOString()
      });
      
      updated++;
    }
    
    return Response.json({
      success: true,
      message: `Updated ${updated} bets with proper betting windows (match kickoff + 1 hour)`,
      updated,
      errors,
    });
    
  } catch (error) {
    console.error('bulkUpdateBettingWindows error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});