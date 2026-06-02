/**
 * Pari-mutuel odds calculator
 * 
 * Formula: odds[i] = (total_pool × (1 - fee%)) / pool[i]
 * 
 * Example:
 *   Brazil pool: 15 SOL, Italy pool: 2 SOL, Draw: 0 SOL
 *   Total pool: 17 SOL, Fee: 2%
 *   
 *   Brazil odds = (17 × 0.98) / 15 = 1.11×
 *   Italy odds  = (17 × 0.98) / 2  = 8.33×
 *   Draw odds   = undefined (infinite - no one bet)
 */

export function calculateParimutuelOdds(poolA, poolB, poolDraw, totalPool, feePercent = 200) {
  if (!totalPool || totalPool === 0) {
    return { oddsA: 1.00, oddsB: 1.00, oddsDraw: 1.00 };
  }

  const feeMultiplier = (10000 - feePercent) / 10000;
  const netPool = totalPool * feeMultiplier;

  const oddsA = poolA > 0 ? netPool / poolA : null;
  const oddsB = poolB > 0 ? netPool / poolB : null;
  const oddsDraw = poolDraw > 0 ? netPool / poolDraw : null;

  return {
    oddsA: oddsA || null,
    oddsB: oddsB || null,
    oddsDraw: oddsDraw || null,
    netPool,
  };
}

export function formatOdds(odds) {
  if (odds === null || odds === undefined) return '—';
  return odds.toFixed(2) + '×';
}

export function calculatePotentialReturn(stake, odds) {
  if (!odds || !stake) return 0;
  return stake * odds;
}