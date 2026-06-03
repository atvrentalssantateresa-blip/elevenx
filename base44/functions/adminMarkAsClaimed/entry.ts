import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Admin-only: Mark won bets as claimed without on-chain transaction
 * Use this when position accounts are missing and claims fail
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    const payload = await req.json();
    const { bet_id, match_id } = payload;

    if (!bet_id && !match_id) {
      return Response.json({ error: 'Missing bet_id or match_id' }, { status: 400 });
    }

    // Get all user bets to mark as claimed
    let userBets;
    if (bet_id) {
      userBets = await base44.entities.UserBet.filter({ bet_id });
    } else if (match_id) {
      userBets = await base44.entities.UserBet.filter({ match_id });
    }

    if (!userBets || userBets.length === 0) {
      return Response.json({ error: 'No user bets found' }, { status: 404 });
    }

    // Filter to only won/active bets
    const betsToClaim = userBets.filter(ub => 
      ub.status === 'won' || ub.status === 'active'
    );

    if (betsToClaim.length === 0) {
      return Response.json({ error: 'No won bets to claim' }, { status: 400 });
    }

    // Mark as claimed
    const updated = [];
    for (const bet of betsToClaim) {
      await base44.entities.UserBet.update(bet.id, {
        status: 'claimed',
        actual_payout: bet.potential_payout || bet.amount || 0,
      });
      updated.push(bet.id);
    }

    console.log(`✓ Admin claim: marked ${updated.length} bet(s) as claimed`);

    return Response.json({
      success: true,
      message: `Marked ${updated.length} bet(s) as claimed`,
      claimed_bet_ids: updated,
      note: 'Bets marked as claimed in database. SOL remains in market PDA.',
    });

  } catch (error) {
    console.error('adminMarkAsClaimed error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});