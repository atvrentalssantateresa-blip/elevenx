import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Commit bet to database AFTER transaction succeeds on-chain.
 * Called by frontend after wallet signs and confirms the transaction.
 * Note: on-chain verification already done by frontend before calling this.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const serviceRole = base44.asServiceRole;
    
    const payload = await req.json();
    const { signature, commit_data } = payload;
    
    if (!signature || !commit_data) {
      return Response.json({ error: 'Missing signature or commit_data' }, { status: 400 });
    }
    
    console.log('[commitBet] Committing bet for signature:', signature.slice(0, 20) + '...');
    
    // Commit UserBet
    const { userBet, offerUpdate, betUpdate } = commit_data;
    
    const newUserBet = await serviceRole.entities.UserBet.create(userBet);
    console.log('[commitBet] Created UserBet:', newUserBet.id);
    
    // Update BetOffer
    await serviceRole.entities.BetOffer.update(offerUpdate.id, offerUpdate);
    console.log('[commitBet] Updated BetOffer:', offerUpdate.id);
    
    // Update Bet pools
    const poolKey = betUpdate.poolKey;
    await serviceRole.entities.Bet.update(betUpdate.bet_id, {
      [poolKey]: betUpdate.currentPool + betUpdate.amount,
      total_pool: (betUpdate.total_pool || 0) + betUpdate.amount,
      total_bettors: (betUpdate.total_bettors || 0) + 1,
    });
    console.log('[commitBet] Updated Bet pools');
    
    return Response.json({
      success: true,
      userBetId: newUserBet.id,
      message: '✓ Bet committed to database',
    });
    
  } catch (error) {
    console.error('[commitBet] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});