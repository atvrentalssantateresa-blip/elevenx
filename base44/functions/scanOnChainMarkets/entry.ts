import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { Connection, PublicKey } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'node:buffer';

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

    // Connect to Solana
    const rpcUrl = 'https://mainnet.helius-rpc.com/?api-key=f0184d45-f52a-44d3-9314-2365f64ea024';
    const programId = new PublicKey('3ecFdHPbcU88UQ37iStPcGaz7Bg16RdSDDYqW5FzPabu');
    const connection = new Connection(rpcUrl, 'confirmed');

    console.log('[scanOnChainMarkets] Fetching program accounts...');
    
    // Fetch all market accounts (dataSize 281)
    const accounts = await connection.getProgramAccounts(programId, {
      filters: [
        { dataSize: 281 }
      ]
    });

    console.log('[scanOnChainMarkets] Found', accounts.length, 'accounts');

    const markets = [];
    const errors = [];

    for (const account of accounts) {
      try {
        const pubkey = account.pubkey.toBase58();
        const data = Buffer.from(account.account.data);
        
        if (data.length < 281) {
          errors.push({ pubkey, error: 'Data too short', length: data.length });
          continue;
        }

        // Parse match_id (bytes 8-39, 32 bytes)
        const matchIdBytes = data.slice(8, 40);
        const matchId = matchIdBytes.toString('utf-8').replace(/\0/g, '');
        
        // Parse team_a (bytes 40-71, 32 bytes)
        const teamABytes = data.slice(40, 72);
        const teamA = teamABytes.toString('utf-8').replace(/\0/g, '');
        
        // Parse team_b (bytes 72-103, 32 bytes)
        const teamBBytes = data.slice(72, 104);
        const teamB = teamBBytes.toString('utf-8').replace(/\0/g, '');
        
        // Parse oracle_odds[0] (byte 156, u64 LE)
        const oracleOdds0Bytes = data.slice(156, 164);
        const oracleOdds0 = Number(oracleOdds0Bytes.readBigUInt64LE(0));
        
        markets.push({
          pubkey,
          match_id: matchId,
          team_a: teamA,
          team_b: teamB,
          oracle_odds_0: oracleOdds0,
          data_length: data.length,
        });
        
      } catch (err) {
        errors.push({
          pubkey: account.pubkey.toBase58(),
          error: err.message,
        });
      }
    }

    return Response.json({
      success: true,
      count: markets.length,
      errors: errors.length,
      markets,
      errors_detail: errors,
    });

  } catch (error) {
    console.error('scanOnChainMarkets error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
});