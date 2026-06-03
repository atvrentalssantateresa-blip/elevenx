import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Auto-fetch live odds from TheStatsAPI for all open bets
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const API_KEY = Deno.env.get('THE_STATS_API_KEY');
    if (!API_KEY) return Response.json({ error: 'THE_STATS_API_KEY not set' }, { status: 500 });

    // Fetch all open bets
    const bets = await base44.entities.Bet.filter({ status: 'open' });
    
    const updated = [];
    const errors = [];

    for (const bet of bets) {
      try {
        if (!bet.stats_api_match_id) {
          errors.push({ bet_id: bet.id, error: 'Missing stats_api_match_id' });
          continue;
        }

        // Fetch odds from TheStatsAPI
        const url = `https://api.thestatsapi.com/api/football/matches/${bet.stats_api_match_id}/odds`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${API_KEY}` },
        });

        if (!res.ok) {
          if (res.status === 404) {
            // Odds not available yet - this is normal for future matches
            continue;
          }
          errors.push({ bet_id: bet.id, error: `API error ${res.status}` });
          continue;
        }

        const json = await res.json();
        const data = json?.data;
        
        if (!data) continue;

        // Parse odds from API response
        let odds1x2 = null;
        let bookmakerName = null;
        
        if (data.bookmakers && Array.isArray(data.bookmakers)) {
          const bm = data.bookmakers.find(b => b.bookmaker === 'Bet365' || b.bookmaker === 'Pinnacle');
          if (bm?.markets?.match_odds) {
            odds1x2 = bm.markets.match_odds;
            bookmakerName = bm.bookmaker;
          }
        }
        
        if (!odds1x2 && data.odds) {
          const oddsData = data.odds;
          const bm = oddsData.bet365 || oddsData.pinnacle || oddsData.kambi || oddsData.betfair;
          if (bm?.['1x2']) {
            odds1x2 = bm['1x2'];
            bookmakerName = bm === oddsData.bet365 ? 'Bet365' : bm === oddsData.pinnacle ? 'Pinnacle' : 'Other';
          }
        }
        
        if (!odds1x2) continue;

        // Extract current odds (last_seen or opening)
        const homeOdds = odds1x2.home?.last_seen || odds1x2.home?.opening || odds1x2.home || 0;
        const drawOdds = odds1x2.draw?.last_seen || odds1x2.draw?.opening || odds1x2.draw || 0;
        const awayOdds = odds1x2.away?.last_seen || odds1x2.away?.opening || odds1x2.away || 0;

        // Update bet with new odds
        await base44.entities.Bet.update(bet.id, {
          odds_a: parseFloat(homeOdds),
          odds_b: parseFloat(awayOdds),
          odds_draw: parseFloat(drawOdds),
          odds_bookmaker: bookmakerName || 'TheStatsAPI',
          odds_updated_at: new Date().toISOString(),
        });

        updated.push({
          bet_id: bet.id,
          odds: { home: parseFloat(homeOdds), draw: parseFloat(drawOdds), away: parseFloat(awayOdds) },
          bookmaker: bookmakerName,
        });

      } catch (error) {
        errors.push({ bet_id: bet.id, error: error.message });
      }
    }

    return Response.json({
      success: true,
      message: `Updated ${updated.length} bets with live odds`,
      updated,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});