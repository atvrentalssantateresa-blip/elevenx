import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { Connection, PublicKey, GetProgramAccountsFilter } from 'npm:@solana/web3.js@1.98.4';

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

    // 1. Fetch all Match records from DB
    const allMatches = await base44.asServiceRole.entities.Match.filter({});
    const matchData = allMatches.map(m => ({
      id: m.id,
      team_a: m.team_a,
      team_b: m.team_b,
      match_id: m.id, // Using entity id as match_id
    }));

    // 2. Fetch ALL program accounts from chain using getProgramAccounts
    const RPC_URL = 'https://mainnet.helius-rpc.com/?api-key=f0184d45-f52a-44d3-9314-2365f64ea024';
    const PROGRAM_ID = '3ecFdHPbcU88UQ37iStPcGaz7Bg16RdSDDYqW5FzPabu';
    
    const connection = new Connection(RPC_URL, 'confirmed');
    const programId = new PublicKey(PROGRAM_ID);
    
    // Filter: dataSize = 281 (matches Market account size)
    const filters = [
      { dataSize: 281 }
    ];
    
    console.log('[scanAllProgramAccounts] Fetching accounts for program:', PROGRAM_ID);
    console.log('[scanAllProgramAccounts] Filter: dataSize=281');
    
    const accounts = await connection.getProgramAccounts(programId, {
      filters,
      commitment: 'confirmed',
    });
    
    console.log('[scanAllProgramAccounts] Found', accounts.length, 'accounts');
    
    // Parse account data
    const onChainMarkets = accounts.map(acc => {
      const pubkey = acc.pubkey.toBase58();
      const data = acc.account.data;
      
      // Parse Market struct (offset 8 to skip discriminator)
      // match_id: 32 bytes at offset 8
      const matchIdBytes = data.slice(8, 40);
      const matchIdRaw = new TextDecoder().decode(matchIdBytes).replace(/\0/g, '');
      
      // is_initialized: u8 at offset 40
      const isInitialized = data[40] === 1;
      
      // settle_after: i64 at offset 41
      const settleAfter = Number(data.readBigInt64LE(41));
      
      // is_settled: u8 at offset 155
      const isSettled = data[155] === 1;
      
      // oracle_odds: [u64; 3] at offset 156
      const oddsA = Number(data.readBigUInt64LE(156));
      const oddsB = Number(data.readBigUInt64LE(164));
      const oddsDraw = Number(data.readBigUInt64LE(172));
      
      return {
        pda: pubkey,
        matchId: matchIdRaw,
        isInitialized,
        settleAfter,
        isSettled,
        oracleOdds: {
          a: oddsA,
          b: oddsB,
          draw: oddsDraw,
        },
        lamports: acc.account.lamports,
      };
    });

    return Response.json({
      success: true,
      dbMatches: {
        count: matchData.length,
        matches: matchData,
      },
      onChainAccounts: {
        count: onChainMarkets.length,
        programId: PROGRAM_ID,
        filter: { dataSize: 281 },
        accounts: onChainMarkets,
      },
      comparison: {
        dbCount: matchData.length,
        onChainCount: onChainMarkets.length,
        difference: matchData.length - onChainMarkets.length,
      },
    });

  } catch (error) {
    console.error('scanAllProgramAccounts error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
});