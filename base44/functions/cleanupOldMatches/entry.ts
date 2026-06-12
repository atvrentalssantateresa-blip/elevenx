import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('[cleanupOldMatches] Starting cleanup...');

    // Fetch real matches from The Odds API
    const apiKey = Deno.env.get('THE_ODDS_API_KEY');
    if (!apiKey) {
      return Response.json({ error: 'THE_ODDS_API_KEY secret not set' }, { status: 500 });
    }

    // Try multiple sport keys - soccer_epl works year-round
    const sportKeys = ['soccer_epl', 'soccer_fifa_world_cup', 'soccer'];
    let apiMatches = [];
    
    for (const sportKey of sportKeys) {
      const apiUrl = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?apiKey=${apiKey}&regions=us&markets=h2h`;
      const apiResponse = await fetch(apiUrl);
      const result = await apiResponse.json();
      if (Array.isArray(result) && result.length > 0) {
        apiMatches = result;
        console.log(`[cleanupOldMatches] Using sport: ${sportKey}, found ${result.length} matches`);
        break;
      }
    }
    
    if (apiMatches.length === 0) {
      return Response.json({ error: 'No matches found from API - try again later', sportKeysTried: sportKeys }, { status: 500 });
    }

    console.log(`[cleanupOldMatches] Fetched ${apiMatches.length} real matches from API`);

    // Build set of real match IDs and normalized team names
    const realMatchIds = new Set();
    const realMatchKeys = new Set();
    
    apiMatches.forEach((match: any) => {
      realMatchIds.add(match.id);
      // Create normalized key: "home_team|away_team|commence_time"
      const key = `${match.home_team}|${match.away_team}|${match.commence_time}`;
      realMatchKeys.add(key);
    });

    // Fetch all matches from database
    const dbMatches = await base44.asServiceRole.entities.Match.list('-created_date', 1000);
    console.log(`[cleanupOldMatches] Found ${dbMatches.length} matches in database`);

    // Identify matches to delete (not in API)
    const matchesToDelete = [];
    const matchesToKeep = [];
    
    dbMatches.forEach((match: any) => {
      // Check if this match exists in API data
      const key = `${match.team_a}|${match.team_b}|${match.match_time}`;
      const reverseKey = `${match.team_b}|${match.team_a}|${match.match_time}`;
      
      if (realMatchKeys.has(key) || realMatchKeys.has(reverseKey)) {
        matchesToKeep.push(match);
      } else {
        matchesToDelete.push(match);
      }
    });

    console.log(`[cleanupOldMatches] To keep: ${matchesToKeep.length}, To delete: ${matchesToDelete.length}`);

    // Delete old matches (with rate limiting)
    let deletedCount = 0;
    for (const match of matchesToDelete) {
      try {
        await base44.asServiceRole.entities.Match.delete(match.id);
        deletedCount++;
        console.log(`[cleanupOldMatches] Deleted match: ${match.id} (${match.team_a} vs ${match.team_b})`);
        // Rate limit: 100ms between deletes
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (err) {
        if (err.status !== 404) {
          console.warn(`[cleanupOldMatches] Failed to delete ${match.id}:`, err.message);
        }
      }
    }

    // Delete Bet records for deleted matches
    const dbBets = await base44.asServiceRole.entities.Bet.list();
    let deletedBetsCount = 0;
    
    for (const bet of dbBets) {
      if (!matchesToKeep.find(m => m.id === bet.match_id)) {
        try {
          await base44.asServiceRole.entities.Bet.delete(bet.id);
          deletedBetsCount++;
          console.log(`[cleanupOldMatches] Deleted orphaned bet: ${bet.id} (${bet.title})`);
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err) {
          if (err.status !== 404) {
            console.warn(`[cleanupOldMatches] Failed to delete bet ${bet.id}:`, err.message);
          }
        }
      }
    }

    return Response.json({
      success: true,
      message: `✅ Cleanup complete! Deleted ${deletedCount} old matches and ${deletedBetsCount} orphaned bets.`,
      deletedMatches: deletedCount,
      deletedBets: deletedBetsCount,
      keptMatches: matchesToKeep.length,
      totalRealMatches: apiMatches.length,
    });
    
  } catch (error) {
    console.error('[cleanupOldMatches] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});