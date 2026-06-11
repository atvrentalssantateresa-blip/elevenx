import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Called client-side AFTER a create_market transaction is confirmed on-chain.
 * Sets solana_market_created: true and solana_market_pda on the Bet entity.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Auth: platform admin or wallet-based admin
    let isAdmin = false;
    try {
      const user = await base44.auth.me();
      if (user && user.role === 'admin') isAdmin = true;
    } catch (_) {}

    if (!isAdmin) {
      try {
        const authHeader = req.headers.get('Authorization') || '';
        const token = authHeader.replace('Bearer ', '');
        if (token) {
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
            if (payload.walletAddress) {
              const walletUsers = await base44.asServiceRole.entities.WalletUser.filter({ wallet_address: payload.walletAddress });
              if (walletUsers[0]?.role === 'admin') isAdmin = true;
            }
          }
        }
      } catch (_) {}
    }

    if (!isAdmin) {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = await req.json();
    const { bet_id, market_pda } = body;

    if (!bet_id || !market_pda) {
      return Response.json({ error: 'Missing bet_id or market_pda' }, { status: 400 });
    }

    await base44.asServiceRole.entities.Bet.update(bet_id, {
      solana_market_created: true,
      solana_market_pda: market_pda,
    });

    console.log(`[commitMarketDeployment] ✓ Bet ${bet_id} marked deployed: ${market_pda}`);

    return Response.json({ success: true, bet_id, market_pda });
  } catch (error) {
    console.error('[commitMarketDeployment] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});