import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const THE_ODDS_API_KEY = Deno.env.get('THE_ODDS_API_KEY');

// Simple flag mapping for common countries
function getFlag(countryName) {
  const flagMap = {
    'Brazil': '🇧🇷',
    'Argentina': '🇦🇷',
    'France': '🇫🇷',
    'Spain': '🇪🇸',
    'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    'Germany': '🇩🇪',
    'Portugal': '🇵🇹',
    'Netherlands': '🇳🇱',
    'Belgium': '🇧🇪',
    'Italy': '🇮🇹',
  };
  return flagMap[countryName] || '🌍';
}

/**
 * Fetches World Cup futures odds from The Odds API
 * Returns winner odds and to reach final odds
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    if (!THE_ODDS_API_KEY) {
      return Response.json({ error: 'THE_ODDS_API_KEY not configured' }, { status: 500 });
    }

    // Fetch World Cup Winner odds
    const winnerResponse = await fetch(
      `https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup_winner/odds?apiKey=${THE_ODDS_API_KEY}&regions=us&markets=h2h&oddsFormat=decimal`,
      { headers: { 'Accept': 'application/json' } }
    );
    
    const winnerData = await winnerResponse.json();
    console.log('World Cup Winner odds:', winnerData);

    // The API returns an array of events (tournaments)
    // For futures, we typically get one event with all outright winners
    let winnerOutcomes = [];
    
    if (Array.isArray(winnerData) && winnerData.length > 0) {
      const event = winnerData[0];
      if (event.bookmakers && event.bookmakers.length > 0) {
        // Get the first bookmaker's odds
        const bookmaker = event.bookmakers[0];
        const markets = bookmaker.markets;
        
        if (markets && markets.length > 0) {
          const h2hMarket = markets.find(m => m.key === 'h2h');
          if (h2hMarket && h2hMarket.outcomes) {
            winnerOutcomes = h2hMarket.outcomes.map(o => ({
              label: o.name,
              odds: o.price,
              pool: 0,
              lp_offers: 0,
            }));
          }
        }
      }
    }

    console.log('Processed winner outcomes:', winnerOutcomes.length);

    // If we got odds, update the World Cup Winner market
    if (winnerOutcomes.length > 0) {
      const futuresMarkets = await base44.entities.FuturesMarket.list();
      const worldCupWinnerMarket = futuresMarkets.find(m => m.title === 'World Cup 2026 Winner');
      
      if (worldCupWinnerMarket) {
        // Sort by odds and take top 2 favorites, rest go to "Other"
        const sorted = winnerOutcomes.sort((a, b) => a.odds - b.odds);
        const top2 = sorted.slice(0, 2);
        const others = sorted.slice(2);
        
        // Calculate "Other" odds (weighted average)
        let otherOdds = 3.0;
        if (others.length > 0) {
          const totalPool = others.reduce((sum, o) => sum + (1 / o.odds), 0);
          otherOdds = totalPool > 0 ? 1 / totalPool : 3.0;
        }
        
        const newOutcomes = [
          { label: top2[0]?.label || 'Team A', flag: getFlag(top2[0]?.label), odds: top2[0]?.odds || 5.0, pool: 0, lp_offers: 0 },
          { label: top2[1]?.label || 'Team B', flag: getFlag(top2[1]?.label), odds: top2[1]?.odds || 6.0, pool: 0, lp_offers: 0 },
          { label: 'Other', flag: '🌍', odds: otherOdds, pool: 0, lp_offers: 0 },
        ];
        
        await base44.entities.FuturesMarket.update(worldCupWinnerMarket.id, {
          outcomes: newOutcomes,
        });
        
        console.log('Updated World Cup Winner market with odds:', newOutcomes.map(o => `${o.label}: ${o.odds}`));
      }
    }

    return Response.json({
      success: true,
      winnerOdds: winnerOutcomes,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('fetchWorldCupFutures error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});