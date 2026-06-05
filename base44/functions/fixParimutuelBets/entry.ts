import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Find all parimutuel bets (role='lp' but _isParimutuel=true, or role='matcher' with offer_id set)
    const allBets = await base44.asServiceRole.entities.UserBet.list();
    
    let updated = 0;
    let errors = [];

    for (const bet of allBets) {
      // Fix parimutuel bets: should have role='matcher' and offer_id=null
      if (bet._isParimutuel === true && bet.role === 'lp') {
        await base44.asServiceRole.entities.UserBet.update(bet.id, {
          role: 'matcher',
          offer_id: null,
        });
        updated++;
        console.log('[fixParimutuelBets] Fixed bet:', bet.id);
      }
      
      // Also fix any matcher bets that accidentally got offer_id set
      if (bet._isParimutuel === true && bet.role === 'matcher' && bet.offer_id !== null) {
        await base44.asServiceRole.entities.UserBet.update(bet.id, {
          offer_id: null,
        });
        updated++;
        console.log('[fixParimutuelBets] Cleared offer_id for bet:', bet.id);
      }
    }

    return Response.json({
      success: true,
      message: `Fixed ${updated} parimutuel bets`,
      updated,
      errors,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});