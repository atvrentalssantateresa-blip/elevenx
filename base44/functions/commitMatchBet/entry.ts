import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { Connection } from 'npm:@solana/web3.js@1.98.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const serviceRole = base44.asServiceRole;
    
    const payload = await req.json();
    const { signature, commit_data } = payload;
    
    if (!signature || !commit_data) {
      return Response.json({ error: 'Missing signature or commit_data' }, { status: 400 });
    }
    
    // Support both old format (offer, userBet, lpField, amount) and new format (userBet, offerUpdate, betUpdate)
    const { offer, userBet, lpField, amount, offerUpdate, betUpdate } = commit_data;
    
    // Skip on-chain verification — frontend already confirmed the tx before calling this
    console.log('[commitMatchBet] Committing bet for signature:', signature?.slice(0, 20) + '...');
    
    // Update BetOffer if exists (for matched bets) - handle both formats
    let newAmountMatched = 0;
    let newAmountUnmatched = 0;
    let newStatus = '';
    
    if (offer) {
      // Old format
      const existingOffer = await serviceRole.entities.BetOffer.get(offer.id);
      if (existingOffer) {
        newAmountMatched = (existingOffer.amount_matched || 0) + (offer.amount_matched || 0);
        newAmountUnmatched = Math.max(0, (existingOffer.amount_unmatched || 0) - (offer.amount_matched || 0));
        newStatus = (existingOffer.amount_unmatched || 0) - (offer.amount_matched || 0) <= 0.0001 ? 'fully_matched' : 'partially_matched';
        
        await serviceRole.entities.BetOffer.update(offer.id, {
          amount_matched: newAmountMatched,
          amount_unmatched: newAmountUnmatched,
          status: newStatus,
        });
        console.log('[commitMatchBet] Updated BetOffer (old format):', offer.id);
      }
    } else if (offerUpdate && userBet?.offer_id) {
      // New format - fixed odds match
      const existingOffer = await serviceRole.entities.BetOffer.get(userBet.offer_id);
      if (existingOffer) {
        newAmountMatched = offerUpdate.amount_matched;
        newAmountUnmatched = offerUpdate.amount_unmatched;
        newStatus = offerUpdate.status;
        
        await serviceRole.entities.BetOffer.update(userBet.offer_id, offerUpdate);
        console.log('[commitMatchBet] Updated BetOffer (new format):', userBet.offer_id);
      }
    }
    
    // CRITICAL FIX: Also update the LP's personal UserBet record with matched stats!
    // This ensures the LP's "My Bets" dashboard shows real-time match progress
    if (userBet?.offer_id && newAmountMatched > 0) {
      const lpUserBets = await serviceRole.entities.UserBet.filter({
        offer_id: userBet.offer_id,
        role: 'lp'
      });
      if (lpUserBets.length > 0) {
        const lpUserBet = lpUserBets[0];
        await serviceRole.entities.UserBet.update(lpUserBet.id, {
          liquidity_matched: newAmountMatched,
          liquidity_unmatched: newAmountUnmatched,
          status: newStatus === 'fully_matched' || newStatus === 'partially_matched' ? 'active' : 'pending'
        });
        console.log('[commitMatchBet] Synced LP UserBet record:', lpUserBet.id, 'matched:', newAmountMatched);
      }
    }
    
    // CRITICAL: Parimutuel bets should NOT have offer_id - they display as bets, not LP positions
    // Only create BetOffer for fixed-odds LP positions (when userBet.offer_id exists)
    let offerId = userBet.offer_id || null;
    
    // Create UserBet record
    const createdBet = await serviceRole.entities.UserBet.create({
      ...userBet,
      _isParimutuel: userBet._isParimutuel || false,
      offer_id: offerId, // null for parimutuel (displays as bet), set for fixed-odds LP
    });
    console.log('[commitMatchBet] Created UserBet:', createdBet.id, 'offer_id:', offerId, '_isParimutuel:', createdBet._isParimutuel);
    
    // Update Bet pool totals and bettor count - handle both formats
    if (betUpdate) {
      // New format
      const bet = await serviceRole.entities.Bet.get(userBet.bet_id);
      if (bet) {
        await serviceRole.entities.Bet.update(userBet.bet_id, {
          [betUpdate.poolKey]: (bet[betUpdate.poolKey] || 0) + betUpdate.amount,
          total_pool: (bet.total_pool || 0) + betUpdate.amount,
          total_bettors: (bet.total_bettors || 0) + 1,
        });
        console.log('[commitMatchBet] Updated Bet pools (new format)');
      }
    } else if (lpField && amount) {
      // Old format
      const bet = await serviceRole.entities.Bet.get(userBet.bet_id);
      if (bet) {
        const poolKey = lpField || (userBet.outcome === 'a' ? 'lp_amount_a' : userBet.outcome === 'b' ? 'lp_amount_b' : 'lp_amount_draw');
        await serviceRole.entities.Bet.update(userBet.bet_id, {
          [poolKey]: (bet[poolKey] || 0) + amount,
          total_pool: (bet.total_pool || 0) + amount,
          total_bettors: (bet.total_bettors || 0) + 1,
        });
        console.log('[commitMatchBet] Updated Bet pools (old format)');
      }
    }
    
    return Response.json({
      success: true,
      userBetId: createdBet.id,
      message: `✓ ◎${amount || betUpdate?.amount || userBet.amount} bet committed successfully!`,
    });
    
  } catch (error) {
    console.error('[commitMatchBet] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});