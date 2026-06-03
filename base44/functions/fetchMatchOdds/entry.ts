import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Fetch live odds from TheStatsAPI for a given match
// Also can fetch match result for settlement

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { stats_api_match_id, action } = body;

    const API_KEY = Deno.env.get('THE_STATS_API_KEY');
    if (!API_KEY) return Response.json({ error: 'THE_STATS_API_KEY not set' }, { status: 500 });

    // action = 'odds' | 'result'
    if (action === 'result') {
      // Fetch match result
      const res = await fetch(`https://api.thestatsapi.com/api/football/matches/${stats_api_match_id}`, {
        headers: { Authorization: `Bearer ${API_KEY}` },
      });
      const data = await res.json();
      const match = data.data;
      if (!match) return Response.json({ error: 'Match not found' }, { status: 404 });

      return Response.json({
        status: match.status, // scheduled | live | finished
        score: match.score,   // { home, away }
        winner: match.score
          ? match.score.home > match.score.away ? 'home'
          : match.score.away > match.score.home ? 'away'
          : 'draw'
          : null,
      });
    }

    // Default: fetch odds via /odds endpoint
    const res = await fetch(`https://api.thestatsapi.com/api/football/matches/${stats_api_match_id}/odds`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    if (!res.ok) {
      console.error('TheStatsAPI odds fetch failed:', res.status, res.url);
      return Response.json({ error: `Stats API error: ${res.status}` }, { status: res.status });
    }

    const json = await res.json();
    console.log('TheStatsAPI response:', json);
    
    // Response structure: { data: { odds: { bet365: { '1x2': { home, draw, away } } } } }
    const oddsData = json?.data?.odds;
    
    if (!oddsData) {
      return Response.json({ odds: null, message: 'No odds available yet' });
    }
    
    // Extract 1X2 odds from first available bookmaker (bet365 preferred)
    const bookmaker = oddsData.bet365 || oddsData.pinnacle || oddsData.kambi || oddsData.betfair;
    
    if (!bookmaker?.['1x2']) {
      return Response.json({ odds: null, message: 'No 1X2 odds available' });
    }
    
    const odds1x2 = bookmaker['1x2'];

    return Response.json({
      odds: {
        home: parseFloat(odds1x2.home || 0),
        draw: parseFloat(odds1x2.draw || 0),
        away: parseFloat(odds1x2.away || 0),
      },
      bookmaker: bookmaker === oddsData.bet365 ? 'Bet365' : 
                 bookmaker === oddsData.pinnacle ? 'Pinnacle' :
                 bookmaker === oddsData.kambi ? 'Kambi' : 'Betfair',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});