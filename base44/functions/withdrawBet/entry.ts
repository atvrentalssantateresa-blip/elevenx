import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Withdraw unmatched portion of a matcher bet (user who placed the initial bet)
// Only the creator can withdraw, only if not matched

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { userBetId } = body;

    if (!userBetId) return Response.json({ error: 'userBetId required' }, { status: 400 });

    // Get the user bet
    const userBets = await base44.entities.UserBet.filter({ id: userBetId });
    const userBet = userBets[0];
    if (!userBet) return Response.json({ error: 'UserBet not found' }, { status: 404 });

    // Only creator can withdraw
    if (userBet.created_by_id !== user.id) {
      return Response.json({ error: 'Not your bet' }, { status: 403 });
    }

    // Can only withdraw pending matcher bets (unmatched)
    if (userBet.status !== 'pending' || userBet.role !== 'matcher') {
      return Response.json({ error: 'Can only withdraw unmatched bets' }, { status: 400 });
    }

    // Update the bet to refunded status
    await base44.entities.UserBet.update(userBetId, {
      status: 'refunded',
      amount: 0,
    });

    // Update bet pool: remove stake from pool
    const bets = await base44.entities.Bet.filter({ id: userBet.bet_id });
    const bet = bets[0];
    if (bet) {
      const poolField = userBet.outcome === 'a' ? 'pool_a' : userBet.outcome === 'b' ? 'pool_b' : 'pool_draw';
      await base44.entities.Bet.update(userBet.bet_id, {
        [poolField]: Math.max(0, (bet[poolField] || 0) - userBet.amount),
        total_pool: Math.max(0, (bet.total_pool || 0) - userBet.amount),
      });
    }

    return Response.json({
      success: true,
      withdrawn: userBet.amount,
      message: `◎${userBet.amount?.toFixed(4)} withdrawn from unmatched bet`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});