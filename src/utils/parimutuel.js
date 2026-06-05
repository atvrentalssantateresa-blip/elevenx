/**
 * Pari-mutuel odds calculator with virtual seeding from API odds
 * 
 * Virtual Seeding: Uses API odds to distribute fair starting liquidity
 * This prevents extreme odds fluctuations on early bets
 * 
 * Formula: odds[i] = (total_pool × (1 - fee%)) / pool[i]
 * 
 * Example:
 *   API odds: Home 2.0x, Away 3.0x, Draw 3.5x
 *   Virtual seed: 10 SOL distributed proportionally
 *   Brazil pool: 15 SOL (5 virtual + 10 real), Italy pool: 2 SOL, Draw: 0 SOL
 *   Total pool: 17 SOL, Fee: 2%
 *   
 *   Brazil odds = (17 × 0.98) / 15 = 1.11×
 *   Italy odds  = (17 × 0.98) / 2  = 8.33×
 *   Draw odds   = undefined (infinite - no one bet)
 */

/**
 * Calculate virtual seed amounts from API odds
 * Distributes a virtual pool (e.g., 10 SOL) proportionally based on inverse odds
 * @param {number} oddsA - API odds for outcome A
 * @param {number} oddsB - API odds for outcome B  
 * @param {number} oddsDraw - API odds for Draw (optional)
 * @param {number} virtualPoolSize - Total virtual SOL to seed (default: 10)
 * @returns {object} { seedA, seedB, seedDraw } - Virtual amounts for each outcome
 */
export function calculateVirtualSeed(oddsA, oddsB, oddsDraw, virtualPoolSize = 10) {
  if (!oddsA || !oddsB || oddsA <= 0 || oddsB <= 0) {
    // Fallback: equal distribution if no valid odds
    const equalShare = virtualPoolSize / (oddsDraw ? 3 : 2);
    return {
      seedA: equalShare,
      seedB: equalShare,
      seedDraw: oddsDraw ? equalShare : 0,
    };
  }

  // Inverse probability: lower odds = higher probability = more seed
  const invA = 1 / oddsA;
  const invB = 1 / oddsB;
  const invDraw = oddsDraw ? 1 / oddsDraw : 0;
  
  const totalInv = invA + invB + invDraw;
  
  return {
    seedA: (invA / totalInv) * virtualPoolSize,
    seedB: (invB / totalInv) * virtualPoolSize,
    seedDraw: invDraw > 0 ? (invDraw / totalInv) * virtualPoolSize : 0,
  };
}

export function calculateParimutuelOdds(poolA, poolB, poolDraw, totalPool, feePercent = 200, virtualSeeds = null) {
  if (!totalPool || totalPool === 0) {
    return { oddsA: 1.00, oddsB: 1.00, oddsDraw: 1.00 };
  }

  const feeMultiplier = (10000 - feePercent) / 10000;
  const netPool = totalPool * feeMultiplier;

  // Add virtual seeds to pools for odds calculation (only for display, not actual balances)
  const effectivePoolA = virtualSeeds ? poolA + virtualSeeds.seedA : poolA;
  const effectivePoolB = virtualSeeds ? poolB + virtualSeeds.seedB : poolB;
  const effectivePoolDraw = virtualSeeds ? poolDraw + virtualSeeds.seedDraw : poolDraw;

  const oddsA = effectivePoolA > 0 ? netPool / effectivePoolA : null;
  const oddsB = effectivePoolB > 0 ? netPool / effectivePoolB : null;
  const oddsDraw = effectivePoolDraw > 0 ? netPool / effectivePoolDraw : null;

  return {
    oddsA: oddsA || null,
    oddsB: oddsB || null,
    oddsDraw: oddsDraw || null,
    netPool,
    virtualSeeds,
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

/**
 * Calculate user's share of the parimutuel pool
 * @param {number} userStake - User's bet amount
 * @param {number} totalPool - Total pool size (including user's stake)
 * @returns {number} Percentage share (0-100)
 */
export function calculatePoolShare(userStake, totalPool) {
  if (!totalPool || totalPool === 0) return 0;
  return (userStake / totalPool) * 100;
}