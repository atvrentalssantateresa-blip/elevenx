import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Update a bet's open_until and settle_after times to allow immediate settlement testing.
 * Admin-only function.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const serviceRole = base44.asServiceRole;
    
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    const payload = await req.json();
    const { bet_id } = payload;
    
    if (!bet_id) {
      return Response.json({ error: 'bet_id required' }, { status: 400 });
    }
    
    // Set times to 1 hour ago (allowing settlement)
    const now = Date.now();
    const oneHourAgo = new Date(now - 3600000).toISOString();
    const twoHoursAgo = new Date(now - 7200000).toISOString();
    
    await serviceRole.entities.Bet.update(bet_id, {
      open_until: twoHoursAgo,
      settle_after: oneHourAgo,
      status: 'closed', // Close betting window
    });
    
    return Response.json({
      success: true,
      message: 'Market times updated for testing - settlement now allowed',
      open_until: twoHoursAgo,
      settle_after: oneHourAgo,
    });
    
  } catch (error) {
    console.error('updateMarketSettleTime error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});