import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Create all 2026 World Cup futures markets
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    console.log('[createAllWorldCupFutures] Starting...');

    // Group stage winners (12 groups)
    const groups = {
      'Group A': ['Canada', 'France', 'South Korea', 'Tunisia'],
      'Group B': ['England', 'Iran', 'Senegal', 'USA'],
      'Group C': ['Denmark', 'Greece', 'Italy', 'Jamaica'],
      'Group D': ['Australia', 'Honduras', 'Nigeria', 'Spain'],
      'Group E': ['Brazil', 'Colombia', 'New Zealand', 'South Africa'],
      'Group F': ['Germany', 'Japan', 'Paraguay', 'Ukraine'],
      'Group G': ['Argentina', 'Croatia', 'Morocco', 'Saudi Arabia'],
      'Group H': ['Belgium', 'Cameroon', 'Portugal', 'Serbia'],
      'Group I': ['China', 'Mexico', 'Netherlands', 'Uruguay'],
      'Group J': ['Austria', 'Egypt', 'Poland', 'Switzerland'],
      'Group K': ['Chile', 'Costa Rica', 'Ivory Coast', 'Sweden'],
      'Group L': ['Ecuador', 'India', 'Norway', 'Turkey'],
    };

    const groupFlags = {
      'Canada': '🇨🇦', 'France': '🇫🇷', 'South Korea': '🇰🇷', 'Tunisia': '🇹🇳',
      'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Iran': '🇮🇷', 'Senegal': '🇸🇳', 'USA': '🇺🇸',
      'Denmark': '🇩🇰', 'Greece': '🇬🇷', 'Italy': '🇮🇹', 'Jamaica': '🇯🇲',
      'Australia': '🇦🇺', 'Honduras': '🇭🇳', 'Nigeria': '🇳🇬', 'Spain': '🇪🇸',
      'Brazil': '🇧🇷', 'Colombia': '🇨🇴', 'New Zealand': '🇳🇿', 'South Africa': '🇿🇦',
      'Germany': '🇩🇪', 'Japan': '🇯🇵', 'Paraguay': '🇵🇾', 'Ukraine': '🇺🇦',
      'Argentina': '🇦🇷', 'Croatia': '🇭🇷', 'Morocco': '🇲🇦', 'Saudi Arabia': '🇸🇦',
      'Belgium': '🇧🇪', 'Cameroon': '🇨🇲', 'Portugal': '🇵🇹', 'Serbia': '🇷🇸',
      'Mexico': '🇲🇽', 'Netherlands': '🇳🇱', 'Uruguay': '🇺🇾', 'China': '🇨🇳',
      'Austria': '🇦🇹', 'Egypt': '🇪🇬', 'Poland': '🇵🇱', 'Switzerland': '🇨🇭',
      'Chile': '🇨🇱', 'Costa Rica': '🇨🇷', 'Ivory Coast': '🇨🇮', 'Sweden': '🇸🇪',
      'Ecuador': '🇪🇨', 'India': '🇮🇳', 'Norway': '🇳🇴', 'Turkey': '🇹🇷',
    };

    let created = 0;

    // Create tournament winner market
    const tournamentWinner = {
      title: 'World Cup Winner',
      subtitle: 'Who will win the 2026 FIFA World Cup?',
      category: 'tournament',
      country: 'World Cup',
      country_flag: '🏆',
      icon: '🏆',
      status: 'open',
      open_until: '2026-07-19T00:00:00.000Z',
      outcomes: [
        { label: 'Brazil', position: '1st', flag: '🇧🇷', odds: 5.0, pool: 0, lp_offers: 0 },
        { label: 'Argentina', position: '2nd', flag: '🇦🇷', odds: 6.0, pool: 0, lp_offers: 0 },
        { label: 'England', position: '3rd', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', odds: 7.0, pool: 0, lp_offers: 0 },
      ],
      total_volume: 0,
      solana_market_created: false,
      solana_market_pda: '',
      winning_outcome: '',
      winning_outcome_label: '',
    };
    await base44.asServiceRole.entities.FuturesMarket.create(tournamentWinner);
    created++;
    console.log('[createAllWorldCupFutures] ✓ Created Tournament Winner');

    // Create top scorer market
    const topScorer = {
      title: 'Golden Boot Winner',
      subtitle: 'Who will be the top scorer?',
      category: 'player',
      country: 'World Cup',
      country_flag: '👟',
      icon: '⚽',
      status: 'open',
      open_until: '2026-07-19T00:00:00.000Z',
      outcomes: [
        { label: 'Haaland', position: '1st', flag: '🇳🇴', odds: 8.0, pool: 0, lp_offers: 0 },
        { label: 'Mbappé', position: '2nd', flag: '🇫🇷', odds: 9.0, pool: 0, lp_offers: 0 },
        { label: 'Vinicius Jr', position: '3rd', flag: '🇧🇷', odds: 10.0, pool: 0, lp_offers: 0 },
      ],
      total_volume: 0,
      solana_market_created: false,
      solana_market_pda: '',
      winning_outcome: '',
      winning_outcome_label: '',
    };
    await base44.asServiceRole.entities.FuturesMarket.create(topScorer);
    created++;
    console.log('[createAllWorldCupFutures] ✓ Created Top Scorer');

    // Create group winner markets
    for (const [groupName, teams] of Object.entries(groups)) {
      const top3 = teams.slice(0, 3);
      const groupMarket = {
        title: `${groupName} Winner`,
        subtitle: `Which team will top ${groupName}?`,
        category: 'tournament',
        country: groupName,
        country_flag: '📊',
        icon: '🏆',
        status: 'open',
        open_until: '2026-06-25T00:00:00.000Z',
        outcomes: top3.map((team, idx) => ({
          label: team,
          position: idx === 0 ? '1st' : idx === 1 ? '2nd' : '3rd',
          flag: groupFlags[team] || '🏳️',
          odds: 2.0 + (idx * 0.5),
          pool: 0,
          lp_offers: 0,
        })),
        total_volume: 0,
        solana_market_created: false,
        solana_market_pda: '',
        winning_outcome: '',
        winning_outcome_label: '',
      };

      await base44.asServiceRole.entities.FuturesMarket.create(groupMarket);
      created++;
      console.log(`[createAllWorldCupFutures] ✓ Created ${groupName}`);
    }

    console.log(`[createAllWorldCupFutures] ✓ Complete! Created ${created} futures markets`);

    return Response.json({
      success: true,
      message: `✓ Created ${created} World Cup futures markets!`,
      total: created,
    });

  } catch (error) {
    console.error('createAllWorldCupFutures error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});