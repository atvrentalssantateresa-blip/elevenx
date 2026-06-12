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
    const url = `https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/scores`;
    const params = new URLSearchParams({
        apiKey: API_KEY,
        daysFrom: 7,
    });
    const fullUrl = `${url}?${params}`;
    console.log('[syncScores] Fetching:', fullUrl);
    const response = await fetch(fullUrl);
    
    console.log('[syncScores] API Response Status:', response.status);
    const responseText = await response.text();
    console.log('[syncScores] API Response:', responseText);
    
    if (response.status === 429) {
      return Response.json({ 
        error: 'The Odds API rate limit exceeded', 
        message: 'Too many requests. Please wait a few minutes before fetching scores again.'
      }, { status: 429 });
    }
    
    if (!response.ok) {
      return Response.json({ 
        error: 'API request failed', 
        message: `Status: ${response.status} - ${responseText}` 
      }, { status: response.status });
    }
    
    let allMatches;
    try {
      allMatches = JSON.parse(responseText);
    } catch (e) {
      return Response.json({ 
        error: 'Invalid API response', 
        message: 'Could not parse JSON: ' + e.message 
      }, { status: 500 });
    }

    const allMatches = await response.json();
    
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

        // Extract scores - API returns home_score and away_score
        const scoreA = matchedGame.home_score !== null ? matchedGame.home_score : 0;
        const scoreB = matchedGame.away_score !== null ? matchedGame.away_score : 0;
        
        // Determine match status from API
        let status = dbMatch.status; // default to existing
        let winner = dbMatch.winner || '';
        
        if (matchedGame.completed) {
          status = 'finished';
          // Determine winner
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

        // Update match with scores
        await base44.entities.Match.update(dbMatch.id, {
          score_a: scoreA,
          score_b: scoreB,
          status: status,
          winner: winner,
        });

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