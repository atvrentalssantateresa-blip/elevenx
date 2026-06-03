import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Create a test bet with a match that HAS odds available now
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const API_KEY = Deno.env.get('THE_STATS_API_KEY');
    if (!API_KEY) return Response.json({ error: 'THE_STATS_API_KEY not set' }, { status: 500 });

    // This match has odds available: Austria vs Guatemala
    const apiMatchId = 'mt_205286328';
    
    // Fetch match details
    const url = `https://api.thestatsapi.com/api/football/matches/${apiMatchId}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    if (!res.ok) {
      return Response.json({ error: `API error ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    const apiMatch = data.data;

    if (!apiMatch) {
      return Response.json({ error: 'Match not found' }, { status: 404 });
    }

    // Create match entity
    const match = await base44.entities.Match.create({
      team_a: apiMatch.home_team?.name || 'Home Team',
      team_b: apiMatch.away_team?.name || 'Away Team',
      team_a_flag: apiMatch.home_team?.code || '🏠',
      team_b_flag: apiMatch.away_team?.code || '✈️',
      group_stage: apiMatch.competition?.name || 'Friendly',
      match_time: apiMatch.utc_date,
      venue: apiMatch.venue?.name || 'TBD',
      status: 'upcoming',
    });

    // Calculate betting times
    const matchTime = new Date(apiMatch.utc_date);
    const openUntil = new Date(matchTime.getTime() - 60 * 60 * 1000);
    if (openUntil < new Date()) {
      openUntil.setTime(Date.now() + 24 * 60 * 60 * 1000);
    }

    // Fetch current odds
    const oddsUrl = `https://api.thestatsapi.com/api/football/matches/${apiMatchId}/odds`;
    const oddsRes = await fetch(oddsUrl, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    let odds_a = 0, odds_b = 0, odds_draw = 0, bookmaker = 'TheStatsAPI';

    if (oddsRes.ok) {
      const oddsData = await oddsRes.json();
      const odds = oddsData.data;
      
      if (odds?.bookmakers?.length > 0) {
        const bm = odds.bookmakers[0];
        bookmaker = bm.bookmaker;
        const m = bm.markets?.match_odds;
        if (m) {
          odds_a = parseFloat(m.home?.last_seen || m.home?.opening || 0);
          odds_draw = parseFloat(m.draw?.last_seen || m.draw?.opening || 0);
          odds_b = parseFloat(m.away?.last_seen || m.away?.opening || 0);
        }
      }
    }

    // Create bet entity with odds
    const bet = await base44.entities.Bet.create({
      match_id: match.id,
      title: `${apiMatch.home_team?.name} vs ${apiMatch.away_team?.name}`,
      outcome_a: apiMatch.home_team?.name || 'Home',
      outcome_b: apiMatch.away_team?.name || 'Away',
      outcome_draw: 'Draw',
      open_until: openUntil.toISOString(),
      status: 'open',
      stats_api_match_id: apiMatchId,
      odds_a,
      odds_b,
      odds_draw,
      odds_bookmaker: bookmaker,
      odds_updated_at: new Date().toISOString(),
    });

    return Response.json({
      success: true,
      message: `Created bet with LIVE ODDS: ${apiMatch.home_team?.name} vs ${apiMatch.away_team?.name}`,
      match_id: match.id,
      bet_id: bet.id,
      stats_api_match_id: apiMatchId,
      odds: { home: odds_a, draw: odds_draw, away: odds_b, bookmaker },
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});