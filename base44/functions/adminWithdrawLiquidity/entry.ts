import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Admin-only function to withdraw unmatched LP liquidity from settled markets.
 * This is a workaround for the on-chain program restriction.
 * Admin must manually transfer the SOL to the LP after calling this.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify admin access
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const payload = await req.json();
    const { userBetId, walletAddress } = payload;

    if (!userBetId) return Response.json({ error: 'Missing userBetId' }, { status: 400 });

    // Fetch UserBet
    const userBets = await base44.entities.UserBet.filter({ id: userBetId });
    const userBet = userBets[0];
    if (!userBet) return Response.json({ error: 'UserBet not found' }, { status: 404 });
    if (userBet.role !== 'lp') return Response.json({ error: 'Not an LP bet' }, { status: 400 });
    
    // Allow withdrawal for refunded bets in settled markets
    if (userBet.status !== 'refunded' && userBet.status !== 'pending') {
      return Response.json({ error: 'Bet is not eligible for admin withdrawal' }, { status: 400 });
    }

    // Fetch BetOffer
    if (!userBet.offer_id) return Response.json({ error: 'No offer linked' }, { status: 400 });
    const offers = await base44.entities.BetOffer.filter({ id: userBet.offer_id });
    const offer = offers[0];
    if (!offer) return Response.json({ error: 'Offer not found' }, { status: 404 });
    
    // Verify there's unmatched liquidity
    const withdrawAmount = offer.amount_unmatched || 0;
    if (withdrawAmount <= 0) {
      return Response.json({ error: 'No unmatched liquidity remaining' }, { status: 400 });
    }

    // Fetch Bet to verify market is settled
    const bets = await base44.entities.Bet.filter({ id: userBet.bet_id });
    const bet = bets[0];
    if (!bet) return Response.json({ error: 'Bet not found' }, { status: 400 });
    if (bet.status !== 'settled') {
      return Response.json({ error: 'Market not settled - use normal withdrawal' }, { status: 400 });
    }

    // Update UserBet to claimed
    await base44.entities.UserBet.update(userBetId, {
      status: 'claimed',
      actual_payout: withdrawAmount,
    });

    // Update BetOffer to mark as withdrawn
    await base44.entities.BetOffer.update(offer.id, {
      status: 'settled',
      amount_unmatched: 0,
    });

    // Update Bet LP totals
    const lpField = userBet.outcome === 'a' ? 'lp_amount_a' : userBet.outcome === 'b' ? 'lp_amount_b' : 'lp_amount_draw';
    await base44.entities.Bet.update(bet.id, {
      [lpField]: (bet[lpField] || 0) - withdrawAmount,
      total_pool: (bet.total_pool || 0) - withdrawAmount,
    });

    console.log(`Admin withdrawal processed for UserBet ${userBetId}: ◎${withdrawAmount} to ${walletAddress || userBet.wallet_address}`);

    return Response.json({
      success: true,
      userBetId,
      offerId: offer.id,
      amount: withdrawAmount,
      walletAddress: walletAddress || userBet.wallet_address,
      message: `Database updated. Admin must manually transfer ◎${withdrawAmount} to ${walletAddress || userBet.wallet_address}`,
    });

  } catch (error) {
    console.error('adminWithdrawLiquidity error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});