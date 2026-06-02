import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Withdraw unmatched portion of a bet offer
// Only the creator can withdraw, only unmatched funds

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { offer_id } = body;

    if (!offer_id) return Response.json({ error: 'offer_id required' }, { status: 400 });

    const offers = await base44.entities.BetOffer.filter({ id: offer_id });
    const offer = offers[0];
    if (!offer) return Response.json({ error: 'Offer not found' }, { status: 404 });

    // Only offer creator can withdraw
    if (offer.created_by_id !== user.id) {
      return Response.json({ error: 'Not your offer' }, { status: 403 });
    }

    if (offer.status === 'cancelled') {
      return Response.json({ error: 'Already cancelled' }, { status: 400 });
    }

    const unmatched = offer.amount_unmatched || 0;
    if (unmatched <= 0) {
      return Response.json({ error: 'No unmatched funds to withdraw' }, { status: 400 });
    }

    // Cancel/reduce the unmatched portion
    const isFullyUnmatched = offer.amount_matched === 0;
    await base44.entities.BetOffer.update(offer_id, {
      amount_unmatched: 0,
      status: isFullyUnmatched ? 'cancelled' : 'fully_matched',
    });

    // Update LP UserBet status
    const lpBets = await base44.entities.UserBet.filter({ offer_id, role: 'lp' });
    if (lpBets[0]) {
      const newStatus = isFullyUnmatched ? 'refunded' : 'active';
      await base44.entities.UserBet.update(lpBets[0].id, {
        status: newStatus,
        amount: offer.amount_matched || 0, // lock only matched portion
      });
    }

    // Update bet pool: remove unmatched from pool
    const bets = await base44.entities.Bet.filter({ id: offer.bet_id });
    const bet = bets[0];
    if (bet) {
      const poolField = offer.outcome === 'a' ? 'pool_a' : offer.outcome === 'b' ? 'pool_b' : 'pool_draw';
      await base44.entities.Bet.update(offer.bet_id, {
        [poolField]: Math.max(0, (bet[poolField] || 0) - unmatched),
        total_pool: Math.max(0, (bet.total_pool || 0) - unmatched),
      });
    }

    return Response.json({
      success: true,
      withdrawn: unmatched,
      message: `◎${unmatched.toFixed(4)} unmatched funds withdrawn`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});