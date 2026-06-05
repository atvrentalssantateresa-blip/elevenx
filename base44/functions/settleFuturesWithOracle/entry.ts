import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ODDS_API_KEY = Deno.env.get('THE_ODDS_API_KEY');
const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';

/**
 * Settle futures market using oracle data from The Odds API.
 * Fetches actual tournament results and settles the market automatically.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const payload = await req.json();
    const { futures_market_id } = payload;

    if (!futures_market_id) {
      return Response.json({ error: 'Missing futures_market_id' }, { status: 400 });
    }

    // Get futures market
    const futuresMarkets = await base44.entities.FuturesMarket.filter({ id: futures_market_id });
    const futuresMarket = futuresMarkets[0];
    
    if (!futuresMarket) {
      return Response.json({ error: 'Futures market not found' }, { status: 404 });
    }

    if (futuresMarket.status === 'settled') {
      return Response.json({ error: 'Futures market already settled' }, { status: 400 });
    }

    // Fetch result from oracle
    const result = await fetchFuturesResult(futuresMarket);
    
    if (!result.winning_position || result.winning_position === 'pending') {
      return Response.json({ 
        error: 'Result not available yet - tournament may still be in progress',
        source: result.source,
        message: result.message
      }, { status: 400 });
    }

    console.log(`Oracle result: ${futuresMarket.country} finished ${result.winning_position}`);

    // Get all user bets for this futures market
    const userBets = await base44.entities.UserBet.filter({ 
      bet_id: futures_market_id 
    });

    let winnersCount = 0;
    let totalPayout = 0;
    let pendingCount = 0;

    // Process each user bet
    for (const ub of userBets) {
      if (ub.status === 'pending') {
        // Pending = unmatched LP — refund the stake
        await base44.entities.UserBet.update(ub.id, { 
          status: 'refunded', 
          actual_payout: 0 
        });
        pendingCount++;
        continue;
      }

      // Check if user bet on the winning position
      const outcomeIndex = ub.outcome === 'a' ? 0 : ub.outcome === 'b' ? 1 : 2;
      const userPosition = futuresMarket.outcomes[outcomeIndex]?.position;

      if (userPosition === result.winning_position && ub.status === 'active') {
        // Winner — payout based on fixed odds
        const payout = ub.potential_payout || 0;
        await base44.entities.UserBet.update(ub.id, {
          status: 'won',
          actual_payout: payout,
        });
        totalPayout += payout;
        winnersCount++;
      } else if (ub.status === 'active') {
        // Loser
        await base44.entities.UserBet.update(ub.id, { 
          status: 'lost', 
          actual_payout: 0 
        });
      }
    }

    // Update futures market status
    await base44.entities.FuturesMarket.update(futures_market_id, {
      status: 'settled',
    });

    console.log(
      `✓ Futures market ${futures_market_id} settled. Winner: ${result.winning_position}, ` +
      `Winners: ${winnersCount}, Pending refunds: ${pendingCount}, Total payout: ◎${totalPayout.toFixed(4)}`
    );

    return Response.json({
      success: true,
      futures_market_id,
      winning_position: result.winning_position,
      winners_count: winnersCount,
      pending_refunds: pendingCount,
      total_payout: totalPayout,
      source: result.source,
      message: `Settled: ${winnersCount} winners | ◎${totalPayout.toFixed(4)} to pay out | ${pendingCount} refunds`,
    });

  } catch (error) {
    console.error('settleFuturesWithOracle error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Fetch futures result from The Odds API or other sources.
 * For World Cup futures, we need to check tournament standings.
 */
async function fetchFuturesResult(market) {
  if (!ODDS_API_KEY) {
    return {
      winning_position: 'pending',
      source: 'no_api_key',
      message: 'THE_ODDS_API_KEY not configured',
    };
  }

  try {
    // The Odds API — soccer_fifa_world_cup outrights market
    const sport = 'soccer_fifa_world_cup';
    const url = `${ODDS_API_BASE}/sports/${sport}/odds?apiKey=${ODDS_API_KEY}&regions=eu&markets=outrights&oddsFormat=decimal`;
    const res = await fetch(url);
    
    if (!res.ok) {
      throw new Error(`Odds API HTTP ${res.status}`);
    }
    
    const events = await res.json();

    // Find the event for this country's futures
    const event = events.find(e => 
      e.home_team?.toLowerCase().includes(market.country.toLowerCase()) ||
      e.away_team?.toLowerCase().includes(market.country.toLowerCase())
    );

    if (!event) {
      return {
        winning_position: 'pending',
        source: 'odds_api',
        message: `No odds data found for ${market.country}`,
      };
    }

    // Check if market is complete (winner determined)
    // For outrights, we look at the odds - if a position has very low odds (<1.1), it's essentially won
    const outrightsMarkets = event.bookmakers
      .map(b => b.markets.find(m => m.key === 'outrights'))
      .filter(Boolean);

    // Analyze outcomes to determine winner
    const positionOdds = {};
    for (const m of outrightsMarkets) {
      for (const outcome of m.outcomes) {
        const name = outcome.name?.toLowerCase();
        if (name?.includes(market.country.toLowerCase())) {
          // Check which position this outcome refers to
          if (name.includes('1st') || name.includes('winner') || name.includes('champion')) {
            positionOdds['1st'] = outcome.price;
          } else if (name.includes('2nd') || name.includes('runner-up')) {
            positionOdds['2nd'] = outcome.price;
          } else if (name.includes('3rd') || name.includes('third')) {
            positionOdds['3rd'] = outcome.price;
          }
        }
      }
    }

    // Determine winner based on odds (odds < 1.01 means essentially certain)
    // Or check if tournament is complete
    if (positionOdds['1st'] && positionOdds['1st'] < 1.01) {
      return {
        winning_position: '1st',
        source: 'odds_api',
        message: `${market.country} won the tournament`,
      };
    }

    // If tournament is over but country didn't win, check for 2nd/3rd
    // This requires additional logic based on tournament structure
    // For now, return pending if not clearly won
    return {
      winning_position: 'pending',
      source: 'odds_api',
      message: `Tournament still in progress for ${market.country}`,
    };

  } catch (err) {
    console.error('Futures result fetch failed:', err.message);
    return {
      winning_position: 'pending',
      source: 'error',
      message: err.message,
    };
  }
}