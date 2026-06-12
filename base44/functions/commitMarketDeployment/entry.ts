import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Called client-side AFTER a create_market transaction is confirmed on-chain.
 * Sets solana_market_created: true and solana_market_pda on the Bet entity.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Wallet-only auth for live site (no platform login required)
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
      return Response.json({ error: 'Missing authorization token' }, { status: 403 });
    }
    
    const parts = token.split('.');
    if (parts.length !== 3) {
      return Response.json({ error: 'Invalid token format' }, { status: 403 });
    }
    
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (!payload.walletAddress) {
      return Response.json({ error: 'Token missing walletAddress' }, { status: 403 });
    }
    
    // Check if wallet is admin using service role (works without platform auth)
    const walletUsers = await base44.asServiceRole.entities.WalletUser.filter({ wallet_address: payload.walletAddress });
    if (!walletUsers[0] || walletUsers[0].role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = await req.json();
    const { bet_id, market_pda, match_id } = body;

    if (!bet_id || !market_pda) {
      return Response.json({ error: 'Missing bet_id or market_pda' }, { status: 400 });
    }

    const updateData = {
      solana_market_created: true,
      solana_market_pda: market_pda,
    };
    
    // Atomic match_id update (for _v2 collision resolution)
    if (match_id) {
      updateData.match_id = match_id;
    }

    await base44.asServiceRole.entities.Bet.update(bet_id, updateData);

    console.log(`[commitMarketDeployment] ✓ Bet ${bet_id} marked deployed: ${market_pda}`);

    return Response.json({ success: true, bet_id, market_pda });
  } catch (error) {
    console.error('[commitMarketDeployment] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});