import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { Connection, PublicKey } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'npm:buffer@6.0.3';

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
      match_id: m.id,
    }));

    // 2. Fetch ALL program accounts from chain
    const RPC_URL = 'https://mainnet.helius-rpc.com/?api-key=f0184d45-f52a-44d3-9314-2365f64ea024';
    const PROGRAM_ID = '3ecFdHPbcU88UQ37iStPcGaz7Bg16RdSDDYqW5FzPabu';
    
    const connection = new Connection(RPC_URL, 'confirmed');
    const programId = new PublicKey(PROGRAM_ID);
    
    const filters = [{ dataSize: 281 }];
    
    const accounts = await connection.getProgramAccounts(programId, {
      filters,
      commitment: 'confirmed',
    });
    
    // Parse account data
    const onChainMarkets = accounts.map(acc => {
      const pubkey = acc.pubkey.toBase58();
      const data = acc.account.data;
      
      const matchIdBytes = data.slice(8, 40);
      const matchIdRaw = new TextDecoder().decode(matchIdBytes).replace(/\0/g, '');
      const teamABytes = data.slice(40, 72);
      const teamA = new TextDecoder().decode(teamABytes).replace(/\0/g, '').trim();
      const teamBBytes = data.slice(72, 103);
      const teamB = new TextDecoder().decode(teamBBytes).replace(/\0/g, '').trim();
      const isInitialized = data[103] === 1;
      const settleAfter = Number(data.readBigInt64LE(104));
      const isSettled = data[155] === 1;
      const oddsA = Number(data.readBigUInt64LE(156));
      const oddsB = Number(data.readBigUInt64LE(164));
      const oddsDraw = Number(data.readBigUInt64LE(172));
      
      return {
        pda: pubkey,
        matchId: matchIdRaw,
        team_a: teamA,
        team_b: teamB,
        isInitialized,
        settleAfter,
        isSettled,
        oracleOdds: { a: oddsA, b: oddsB, draw: oddsDraw },
        lamports: acc.account.lamports,
      };
    });
    
    // 3. Build lookup maps
    const onChainByTeams = new Map();
    onChainMarkets.forEach(oc => {
      const key = `${oc.team_a.toLowerCase().trim()}|${oc.team_b.toLowerCase().trim()}`;
      onChainByTeams.set(key, oc);
    });
    
    // 4. Find MISSING matches only
    const MISSING = [];
    
    matchData.forEach(dbMatch => {
      const dbTeamA = dbMatch.team_a.toLowerCase().trim();
      const dbTeamB = dbMatch.team_b.toLowerCase().trim();
      const key = `${dbTeamA}|${dbTeamB}`;
      const onChain = onChainByTeams.get(key);
      
      // Skip if bettable market exists
      if (onChain && onChain.oracleOdds.a > 100) {
        return;
      }
      
      // This is a MISSING match
      if (onChain) {
        // Market exists but has dead odds
        MISSING.push({
          home_team: dbMatch.team_a,
          away_team: dbMatch.team_b,
          match_id: dbMatch.match_id,
          pdaStatus: 'OCCUPIED_DEAD',
          details: {
            reason: 'on_chain_market_exists_but_dead_odds',
            pda: onChain.pda,
            oracleOdds: onChain.oracleOdds,
            lamports: onChain.lamports,
          },
        });
      } else {
        // No on-chain market - check if PDA is occupied by something else
        const matchIdBytes = Buffer.alloc(32);
        Buffer.from(dbMatch.match_id, 'utf-8').copy(matchIdBytes, 0, 0, Math.min(dbMatch.match_id.length, 32));
        const [expectedPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('market'), matchIdBytes],
          programId
        );
        const expectedPdaStr = expectedPda.toBase58();
        
        const pdaOccupant = onChainMarkets.find(oc => oc.pda === expectedPdaStr);
        
        MISSING.push({
          home_team: dbMatch.team_a,
          away_team: dbMatch.team_b,
          match_id: dbMatch.match_id,
          pdaStatus: pdaOccupant ? 'OCCUPIED_FAKE' : 'FREE',
          details: pdaOccupant ? {
            reason: 'pda_occupied_by_different_market',
            pda: expectedPdaStr,
            actualHomeTeam: pdaOccupant.team_a,
            actualAwayTeam: pdaOccupant.team_b,
            oracleOdds: pdaOccupant.oracleOdds,
            lamports: pdaOccupant.lamports,
          } : {
            reason: 'no_on_chain_market',
            pda: expectedPdaStr,
            isFree: true,
          },
        });
      }
    });
    
    // Summary by PDA status
    const summary = {
      totalMissing: MISSING.length,
      occupiedDead: MISSING.filter(m => m.pdaStatus === 'OCCUPIED_DEAD').length,
      occupiedFake: MISSING.filter(m => m.pdaStatus === 'OCCUPIED_FAKE').length,
      freePda: MISSING.filter(m => m.pdaStatus === 'FREE').length,
    };

    return Response.json({
      success: true,
      summary,
      MISSING,
    });

  } catch (error) {
    console.error('getMissingMatches error:', error);
    return Response.json({ 
      error: error.message,
    }, { status: 500 });
  }
});