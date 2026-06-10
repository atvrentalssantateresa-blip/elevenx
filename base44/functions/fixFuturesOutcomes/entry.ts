import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Fix futures market outcomes - each country should have 3 outcomes (1st, 2nd, 3rd place finish)
 * with the SAME country name and flag, just different positions and odds
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const allMarkets = await base44.asServiceRole.entities.FuturesMarket.filter({});
    
    let updated = 0;
    const updates = [];

    for (const market of allMarkets) {
      // Skip tournament-wide markets
      if (market.country === 'World Cup' || market.country === 'Test' || market.country?.includes('Group ')) {
        continue;
      }

      // Fix outcomes - all 3 should have the same country/flag, just different positions
      const correctedOutcomes = [
        {
          label: market.country,
          position: '1st',
          flag: market.country_flag || '🏳️',
          odds: market.outcomes?.[0]?.odds || 1.8,
          pool: market.outcomes?.[0]?.pool || 0,
          lp_offers: market.outcomes?.[0]?.lp_offers || 0,
        },
        {
          label: market.country,
          position: '2nd',
          flag: market.country_flag || '🏳️',
          odds: market.outcomes?.[1]?.odds || 2.5,
          pool: market.outcomes?.[1]?.pool || 0,
          lp_offers: market.outcomes?.[1]?.lp_offers || 0,
        },
        {
          label: market.country,
          position: '3rd',
          flag: market.country_flag || '🏳️',
          odds: market.outcomes?.[2]?.odds || 3.2,
          pool: market.outcomes?.[2]?.pool || 0,
          lp_offers: market.outcomes?.[2]?.lp_offers || 0,
        },
      ];

      // Only update if outcomes actually need fixing
      const needsUpdate = market.outcomes.some((o, i) => 
        o.label !== market.country || correctedOutcomes[i].flag !== market.country_flag
      );

      if (needsUpdate) {
        await base44.asServiceRole.entities.FuturesMarket.update(market.id, {
          outcomes: correctedOutcomes,
        });
        updated++;
        updates.push(`${market.country}: fixed outcomes`);
        console.log(`[fixFuturesOutcomes] ✓ Updated ${market.country}`);
      }
    }

    console.log(`[fixFuturesOutcomes] Complete: ${updated} markets updated`);

    return Response.json({
      success: true,
      message: `✓ Fixed ${updated} futures markets`,
      updated,
      details: updates.slice(0, 10),
    });

  } catch (error) {
    console.error('fixFuturesOutcomes error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});