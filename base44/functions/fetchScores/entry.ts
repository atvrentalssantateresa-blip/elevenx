import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Fetch live scores from The Odds API and update Match entity
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const API_KEY = Deno.env.get('THE_ODDS_API_KEY');
    if (!API_KEY) return Response.json({ error: 'THE_ODDS_API_KEY not set' }, { status: 500 });

    // Fetch games with scores from The Odds API
    // Note: The Odds API provides scores in the main odds endpoint for live/completed games
    const url = `https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds`;
    const params = new URLSearchParams({
        apiKey: API_KEY,
        regions: 'eu',
        markets: 'h2h',
        oddsFormat: 'decimal',
    });
    const response = await fetch(`${url}?${params}`);
    
    if (response.status === 429) {
      return Response.json({ 
        error: 'The Odds API rate limit exceeded', 
        message: 'Too many requests. Please wait a few minutes before fetching scores again.',
      }, { status: 429 });
    }
    
    if (!response.ok) {
      return Response.json({ 
        error: 'API request failed', 
        message: `Status: ${response.status}` 
      }, { status: response.status });
    }

    const allGames = await response.json();
    
    if (!Array.isArray(allGames)) {
      return Response.json({ 
        error: 'Invalid API response', 
        message: 'Expected array of games' 
      }, { status: 500 });
    }

    // Fetch all matches from database
    const matches = await base44.entities.Match.list();
    
    const updated = [];
    const errors = [];

    for (const game of allGames) {
      try {
        // Find matching match by team names
        const matchedMatch = matches.find(match => {
          const home = game.home_team.toLowerCase();
          const away = game.away_team.toLowerCase();
          const teamA = match.team_a.toLowerCase();
          const teamB = match.team_b.toLowerCase();
          
          // Try exact match
          if (home === teamA && away === teamB) return true;
          
          // Try reverse (API might have teams swapped)
          if (home === teamB && away === teamA) return true;
          
          // Try partial match
          if ((home.includes(teamA) || teamA.includes(home)) &&
              (away.includes(teamB) || teamB.includes(away))) return true;
          
          return false;
        });

        if (!matchedMatch) {
          continue; // Skip games not in our database
        }

        // Determine status and scores
        const isCompleted = game.completed;
        const commencingTime = new Date(game.commence_time);
        const now = new Date();
        
        let status = matchedMatch.status;
        let scoreA = matchedMatch.score_a || 0;
        let scoreB = matchedMatch.score_b || 0;
        let winner = matchedMatch.winner || '';

        // Extract scores from API
        if (game.scores && Array.isArray(game.scores)) {
          // The Odds API returns scores as [{name: 'Team Name', score: '2'}, ...]
          const homeScore = game.scores.find(s => s.name === game.home_team)?.score;
          const awayScore = game.scores.find(s => s.name === game.away_team)?.score;
          
          if (homeScore !== undefined && awayScore !== undefined) {
            scoreA = parseInt(homeScore) || 0;
            scoreB = parseInt(awayScore) || 0;
          }
        }

        // Determine status and winner
        if (isCompleted) {
          status = 'finished';
          if (scoreA > scoreB) winner = 'team_a';
          else if (scoreB > scoreA) winner = 'team_b';
          else winner = 'draw';
        } else if (commencingTime <= now) {
          // Game should have started but not completed = live
          status = 'live';
        } else {
          status = 'upcoming';
        }

        // Update match in database
        await base44.entities.Match.update(matchedMatch.id, {
          status,
          score_a: scoreA,
          score_b: scoreB,
          winner,
        });

        updated.push({
          match_id: matchedMatch.id,
          teams: `${matchedMatch.team_a} vs ${matchedMatch.team_b}`,
          status,
          score: `${scoreA} - ${scoreB}`,
          winner,
        });

      } catch (error) {
        errors.push({ game: game.home_team + ' vs ' + game.away_team, error: error.message });
      }
    }

    const message = updated.length > 0 
      ? `✅ Updated ${updated.length} matches with live scores`
      : `⚠️ No score updates found. Matches might not be in API yet.`;

    return Response.json({
      success: updated.length > 0,
      message,
      updated,
      errors: errors.length > 0 ? errors : undefined,
      totalGamesFromApi: allGames.length,
    });

  } catch (error) {
    console.error('fetchScores error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});