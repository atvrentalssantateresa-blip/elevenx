import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Search TheStatsAPI for matches by team name or date
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json();
    const { team_name, date, competition_id } = body;

    const API_KEY = Deno.env.get('THE_STATS_API_KEY');
    if (!API_KEY) return Response.json({ error: 'THE_STATS_API_KEY not set' }, { status: 500 });

    const params = new URLSearchParams({ per_page: '20' });
    if (competition_id) params.set('competition_id', competition_id);
    if (date) params.set('date_from', date), params.set('date_to', date);

    const url = `https://api.thestatsapi.com/api/football/matches?${params}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    if (!res.ok) {
      const text = await res.text();
      return Response.json({ error: `API error ${res.status}: ${text}` }, { status: res.status });
    }

    const data = await res.json();
    let matches = data.data || [];

    // Filter by team name if provided
    if (team_name) {
      const q = team_name.toLowerCase();
      matches = matches.filter(m =>
        m.home_team?.name?.toLowerCase().includes(q) ||
        m.away_team?.name?.toLowerCase().includes(q)
      );
    }

    return Response.json({
      matches: matches.map(m => ({
        id: m.id,
        home: m.home_team?.name,
        away: m.away_team?.name,
        date: m.utc_date,
        competition: m.competition,
        status: m.status,
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});