import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
        }

        const { bet_id, stats_api_match_id } = await req.json();
        
        if (!bet_id || !stats_api_match_id) {
            return Response.json({ error: 'Missing bet_id or stats_api_match_id' }, { status: 400 });
        }

        const apiKey = Deno.env.get('THE_STATS_API_KEY');
        if (!apiKey) {
            return Response.json({ error: 'THE_STATS_API_KEY not configured' }, { status: 500 });
        }

        // Fetch odds from TheStatsAPI
        const url = `https://api.thestatsapi.com/v1/match/${stats_api_match_id}/odds?apiKey=${apiKey}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            return Response.json({ 
                error: 'API request failed', 
                message: `Status: ${response.status}` 
            }, { status: response.status });
        }

        const data = await response.json();
        
        if (!data.odds || !data.bookmaker) {
            return Response.json({ 
                error: 'No odds available', 
                message: 'Odds data not found for this match' 
            }, { status: 404 });
        }

        // Update bet entity with fresh odds
        await base44.entities.Bet.update(bet_id, {
            odds_a: data.odds.home,
            odds_b: data.odds.away,
            odds_draw: data.odds.draw,
            odds_bookmaker: data.bookmaker,
            odds_updated_at: new Date().toISOString()
        });

        return Response.json({
            success: true,
            bookmaker: data.bookmaker,
            odds: data.odds,
            message: 'Odds updated successfully'
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});