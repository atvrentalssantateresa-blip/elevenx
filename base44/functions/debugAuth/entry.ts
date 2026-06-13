import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const serviceRole = base44.asServiceRole;
    
    // Debug: Log ALL headers to see what's being sent
    const allHeaders = {};
    req.headers.forEach((value, key) => {
      allHeaders[key] = value;
    });
    
    console.log('[debugAuth] ALL HEADERS:', JSON.stringify(allHeaders, null, 2));
    
    // Try to get auth from multiple sources
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    
    console.log('[debugAuth] Authorization header:', authHeader ? authHeader.slice(0, 50) + '...' : 'MISSING');
    console.log('[debugAuth] Token extracted:', token ? token.slice(0, 20) + '...' : 'NONE');
    
    // Decode token if present
    if (token && token.split('.').length === 3) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        console.log('[debugAuth] Token payload:', {
          walletAddress: payload.walletAddress?.slice(0, 8),
          role: payload.role,
          userId: payload.userId,
        });
      } catch (e) {
        console.log('[debugAuth] Could not decode token:', e.message);
      }
    }
    
    return Response.json({
      headers_received: Object.keys(allHeaders),
      has_authorization: !!authHeader,
      token_length: token?.length || 0,
    });
    
  } catch (error) {
    console.error('debugAuth error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});