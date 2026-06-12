import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Fetch live scores from The Odds API and update Match entities
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const API_KEY = Deno.env.get('THE_ODDS_API_KEY');
    if (!API_KEY) return Response.json({ error: 'THE_ODDS_API_KEY not set' }, { status: 500 });

    // Fetch all matches with scores from The Odds API
    const url = `https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/scores/?apiKey=${API_KEY}&daysFrom=3`;
    console.log('[syncScores] Fetching:', url);
    const response = await fetch(url);
    
    console.log('[syncScores] API Response Status:', response.status);
    
    if (response.status === 429) {
      return Response.json({ 
        error: 'The Odds API rate limit exceeded', 
        message: 'Too many requests. Please wait a few minutes before fetching scores again.'
      }, { status: 429 });
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      return Response.json({ 
        error: 'API request failed', 
        message: `Status: ${response.status} - ${errorText}` 
      }, { status: response.status });
    }
    
    const allMatches = await response.json();
    console.log('[syncScores] Parsed matches:', allMatches.length);
    
    if (!Array.isArray(allMatches)) {
      return Response.json({ 
        error: 'Invalid API response', 
        message: 'Expected array of matches' 
      }, { status: 500 });
    }

    // Fetch all matches from database
    const dbMatches = await base44.entities.Match.list();
    
    const updated = [];
    const errors = [];

    for (const dbMatch of dbMatches) {
      try {
        // Find matching game by team names (flexible matching)
        const matchedGame = allMatches.find(game => {
          const home = game.home_team.toLowerCase();
          const away = game.away_team.toLowerCase();
          const teamA = dbMatch.team_a.toLowerCase();
          const teamB = dbMatch.team_b.toLowerCase();
          
          // Try exact match
          if (home === teamA && away === teamB) return true;
          
          // Try reverse (API might have teams swapped)
          if (home === teamB && away === teamA) return true;
          
          // Try partial match (e.g. "Czech Republic" vs "Czechia")
          if ((home.includes(teamA) || teamA.includes(home)) &&
              (away.includes(teamB) || teamB.includes(away))) return true;
          
          return false;
        });

        if (!matchedGame) {
          // Skip if match not found in API (might be future match)
          continue;
        }

        // Extract scores - API structure varies by sport/status
        let scoreA = 0;
        let scoreB = 0;
        
        // Try different score field names
        if (matchedGame.home_score !== undefined && matchedGame.home_score !== null) {
          scoreA = matchedGame.home_score;
        }
        if (matchedGame.away_score !== undefined && matchedGame.away_score !== null) {
          scoreB = matchedGame.away_score;
        }
        
        // Some APIs use scores object
        if (matchedGame.scores) {
          if (matchedGame.scores.home_score !== undefined) scoreA = matchedGame.scores.home_score;
          if (matchedGame.scores.away_score !== undefined) scoreB = matchedGame.scores.away_score;
        }
        
        // Determine match status from API
        let status = dbMatch.status;
        let winner = dbMatch.winner || '';
        
        if (matchedGame.completed) {
          status = 'finished';
          if (scoreA > scoreB) winner = 'team_a';
          else if (scoreB > scoreA) winner = 'team_b';
          else winner = 'draw';
        } else if (matchedGame.commence_time) {
          const commenceTime = new Date(matchedGame.commence_time);
          const now = new Date();
          if (commenceTime <= now) {
            status = 'live';
          }
        }

        // Update match with scores (batched to avoid rate limits)
        await base44.entities.Match.update(dbMatch.id, {
          score_a: scoreA,
          score_b: scoreB,
          status: status,
          winner: winner,
        });
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

        updated.push({
          match_id: dbMatch.id,
          teams: `${dbMatch.team_a} vs ${dbMatch.team_b}`,
          score: `${scoreA} - ${scoreB}`,
          status: status,
          winner: winner,
        });

      } catch (error) {
        errors.push({ match_id: dbMatch.id, error: error.message });
      }
    }

    const message = updated.length > 0 
      ? `✅ Updated ${updated.length} matches with live scores`
      : `⚠️ No score updates found. Matches might not have started yet.`;

    return Response.json({
      success: updated.length > 0,
      message,
      updated,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    console.error('syncScores error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});