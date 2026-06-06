import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Fix LP position win/loss status for already-settled markets.
 * LP wins when backed outcome LOSES, loses when backed outcome WINS.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const payload = await req.json();
    const { bet_id } = payload;

    if (!bet_id) {
      return Response.json({ error: 'bet_id required' }, { status: 400 });
    }

    // Get the bet to find winning outcome
    const bets = await base44.entities.Bet.filter({ id: bet_id });
    const bet = bets[0];
    if (!bet || bet.status !== 'settled') {
      return Response.json({ error: 'Bet not found or not settled' }, { status: 400 });
    }

    const winningOutcome = bet.winning_outcome;
    console.log(`Fixing LP positions for bet ${bet_id}, winner: ${winningOutcome}`);

    // Get all LP positions for this bet
    const lpPositions = await base44.entities.UserBet.filter({ 
      bet_id, 
      role: 'lp',
      status: { $in: ['won', 'lost'] } // Only already settled ones
    });

    let fixedCount = 0;
    for (const lp of lpPositions) {
      const backedWinner = lp.outcome === winningOutcome;
      const shouldBeWon = !backedWinner; // LP wins when backed outcome LOSES
      const currentStatus = lp.status;
      const shouldBeStatus = shouldBeWon ? 'won' : 'lost';

      if (currentStatus !== shouldBeStatus) {
        console.log(`Fixing LP ${lp.id}: backed ${lp.outcome}, winner=${winningOutcome}, ${currentStatus}→${shouldBeStatus}`);
        
        await base44.entities.UserBet.update(lp.id, {
          status: shouldBeStatus,
          actual_payout: shouldBeWon ? (lp.liquidity_matched * 0.02) : 0,
        });
        fixedCount++;
      }
    }

    console.log(`✓ Fixed ${fixedCount} LP positions`);
    return Response.json({ 
      success: true, 
      fixed_count: fixedCount,
      message: `Fixed ${fixedCount} LP position(s) for bet ${bet_id}`
    });

  } catch (error) {
    console.error('fixLpStatus error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});