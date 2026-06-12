import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Admin auth check
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

    // Fetch all Match records
    const allMatches = await base44.asServiceRole.entities.Match.filter({});
    
    // Extract requested fields
    const matches = allMatches.map(match => ({
      id: match.id,
      home_team: match.team_a,
      away_team: match.team_b,
      match_id: match.id, // Using entity id as match_id
    }));
    
    return Response.json({
      success: true,
      count: matches.length,
      matches,
    });

  } catch (error) {
    console.error('getAllMatches error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
});