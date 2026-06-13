import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Finalizes LP withdrawal after Solana transaction is confirmed.
 * Updates database records to reflect the withdrawal.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const payload = await req.json();
    const { userBetId, offerId, signature } = payload;

    if (!userBetId) {
      return Response.json({ error: 'Missing userBetId' }, { status: 400 });
    }

    if (!signature) {
      return Response.json({ error: 'Missing transaction signature' }, { status: 400 });
    }

    // Fetch UserBet
    const userBets = await base44.entities.UserBet.filter({ id: userBetId });
    const userBet = userBets[0];
    if (!userBet) {
      return Response.json({ error: 'UserBet not found' }, { status: 404 });
    }
    if (userBet.role !== 'lp') {
      return Response.json({ error: 'Not an LP bet' }, { status: 400 });
    }
    // Allow finalization for won/settled LP positions (winnings claim) or pending/active (unmatched withdrawal)
    // Also allow if already refunded/claimed (idempotent - don't error on double-call)
    if (!['pending', 'active', 'won', 'settled', 'refunded', 'claimed'].includes(userBet.status)) {
      return Response.json({ error: 'Bet status does not allow withdrawal' }, { status: 400 });
    }
    // Idempotent: already finalized
    if (['refunded', 'claimed'].includes(userBet.status)) {
      return Response.json({ success: true, userBetId, message: 'Already finalized', alreadyDone: true });
    }

    // Resolve offer: prefer explicit offerId, fall back to userBet.offer_id
    const resolvedOfferId = offerId || userBet.offer_id || null;
    let offer = null;
    if (resolvedOfferId) {
      const offers = await base44.entities.BetOffer.filter({ id: resolvedOfferId });
      offer = offers[0] || null;
    }

    // Fetch Bet to update LP totals
    const bets = await base44.entities.Bet.filter({ id: userBet.bet_id });
    const bet = bets[0];

    const withdrawAmount = userBet.amount || (offer ? offer.amount_unmatched : 0) || 0;

    // Update database records
    // For won/settled LP positions: mark as claimed; otherwise mark as withdrawn
    const newUserBetStatus = ['won', 'settled'].includes(userBet.status) ? 'claimed' : 'withdrawn';
    
    await base44.entities.UserBet.update(userBetId, { 
      status: newUserBetStatus,
      liquidity_unmatched: 0,
    });
    
    // Always mark BetOffer as withdrawn with amount_unmatched=0 so frontend filters it out
    if (offer) {
      const offerStatus = ['won', 'settled'].includes(userBet.status) ? 'settled' : 'withdrawn';
      await base44.entities.BetOffer.update(offer.id, { 
        status: offerStatus,
        amount_unmatched: 0,
      });
    }
    
    // Update Bet LP totals
    if (bet) {
      const lpField = userBet.outcome === 'a' ? 'lp_amount_a' : userBet.outcome === 'b' ? 'lp_amount_b' : 'lp_amount_draw';
      await base44.entities.Bet.update(userBet.bet_id, {
        [lpField]: Math.max(0, (bet[lpField] || 0) - withdrawAmount),
      });
    }

    console.log(`Withdrawal finalized: UserBet ${userBetId}, Offer ${offerId}, amount: ${withdrawAmount}, signature: ${signature}`);

    return Response.json({
      success: true,
      userBetId,
      offerId,
      signature,
      amount: withdrawAmount,
      message: `Withdrawn ◎${withdrawAmount}`,
    });

  } catch (error) {
    console.error('finalizeWithdrawal error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});