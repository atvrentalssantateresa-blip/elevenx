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

    // Default: fetch odds
    const res = await fetch(`https://api.thestatsapi.com/api/football/matches/${stats_api_match_id}/odds`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    if (!res.ok) {
      return Response.json({ error: `Stats API error: ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    // Real response: { data: { match_id, bookmakers: [{ bookmaker, markets: { match_odds: { home: { last_seen }, draw: { last_seen }, away: { last_seen } } } }] } }
    const bookmakers = data?.data?.bookmakers || [];

    // Prefer Pinnacle → Bet365 → first available
    const priority = ['Pinnacle', 'Bet365', 'Betfair Exchange', 'Kambi'];
    let chosen = null;
    for (const name of priority) {
      chosen = bookmakers.find(b => b.bookmaker === name);
      if (chosen?.markets?.match_odds) break;
    }
    if (!chosen) chosen = bookmakers.find(b => b.markets?.match_odds);
    if (!chosen) return Response.json({ odds: null, message: 'No odds available yet' });

    const mo = chosen.markets.match_odds;
    const getOdd = (side) => parseFloat(mo[side]?.last_seen || mo[side]?.opening || 0);

    return Response.json({
      odds: {
        home: getOdd('home'),
        draw: getOdd('draw'),
        away: getOdd('away'),
      },
      bookmaker: chosen.bookmaker,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});