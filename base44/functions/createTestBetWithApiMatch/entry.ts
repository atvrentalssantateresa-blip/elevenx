import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Create a test bet with real API match data for testing odds fetching
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const API_KEY = Deno.env.get('THE_STATS_API_KEY');
    if (!API_KEY) return Response.json({ error: 'THE_STATS_API_KEY not set' }, { status: 500 });

    // Fetch upcoming matches from API
    const url = `https://api.thestatsapi.com/api/football/matches?per_page=5`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    if (!res.ok) {
      return Response.json({ error: `API error ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    const matches = data.data || [];

    if (matches.length === 0) {
      return Response.json({ error: 'No upcoming matches found in API' }, { status: 404 });
    }

    // Pick the first upcoming match
    const apiMatch = matches.find(m => m.status === 'NS') || matches[0];
    
    if (!apiMatch) {
      return Response.json({ error: 'No suitable match found' }, { status: 404 });
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

    // Calculate betting times (open until 1 hour before match)
    const matchTime = new Date(apiMatch.utc_date);
    const openUntil = new Date(matchTime.getTime() - 60 * 60 * 1000); // 1 hour before
    if (openUntil < new Date()) {
      openUntil.setTime(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now if match is soon
    }

    // Create bet entity with stats_api_match_id
    const bet = await base44.entities.Bet.create({
      match_id: match.id,
      title: `${apiMatch.home_team?.name} vs ${apiMatch.away_team?.name}`,
      outcome_a: apiMatch.home_team?.name || 'Home',
      outcome_b: apiMatch.away_team?.name || 'Away',
      outcome_draw: 'Draw',
      open_until: openUntil.toISOString(),
      status: 'open',
      stats_api_match_id: apiMatch.id,
      odds_bookmaker: 'TheStatsAPI',
      odds_updated_at: new Date().toISOString(),
    });

    return Response.json({
      success: true,
      message: `Created test bet: ${apiMatch.home_team?.name} vs ${apiMatch.away_team?.name}`,
      match_id: match.id,
      bet_id: bet.id,
      stats_api_match_id: apiMatch.id,
      match_time: apiMatch.utc_date,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});