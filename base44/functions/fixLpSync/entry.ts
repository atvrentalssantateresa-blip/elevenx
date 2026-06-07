import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Fix existing UserBet records for futures LP positions
 * Syncs liquidity_matched/liquidity_unmatched from BetOffer
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const serviceRole = base44.asServiceRole;
    
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Fetch all LP UserBets
    const allUserBets = await serviceRole.entities.UserBet.list('-created_date', 500);
    const lpUserBets = allUserBets.filter(ub => ub.role === 'lp' && ub.offer_id);
    
    console.log('[fixLpSync] Found', lpUserBets.length, 'LP UserBets with offer_id');
    
    let updated = 0;
    let errors = 0;
    
    for (const ub of lpUserBets) {
      try {
        // Fetch the corresponding BetOffer
        const offers = await serviceRole.entities.BetOffer.filter({ id: ub.offer_id });
        const offer = offers[0];
        
        if (!offer) {
          console.log('[fixLpSync] No BetOffer found for UserBet:', ub.id);
          continue;
        }
        
        // Check if sync is needed
        const needsSync = 
          ub.liquidity_matched !== offer.amount_matched ||
          ub.liquidity_unmatched !== offer.amount_unmatched;
        
        if (needsSync) {
          await serviceRole.entities.UserBet.update(ub.id, {
            liquidity_matched: offer.amount_matched,
            liquidity_unmatched: offer.amount_unmatched,
            status: offer.status === 'fully_matched' || offer.status === 'settled' ? 'active' : ub.status,
          });
          console.log('[fixLpSync] ✓ Updated UserBet:', ub.id, {
            matched: offer.amount_matched,
            unmatched: offer.amount_unmatched,
            offer_status: offer.status,
          });
          updated++;
        }
      } catch (err) {
        console.error('[fixLpSync] Error updating UserBet:', ub.id, err);
        errors++;
      }
    }
    
    return Response.json({
      success: true,
      updated,
      errors,
      message: `Fixed ${updated} LP positions`,
    });
    
  } catch (error) {
    console.error('[fixLpSync] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});