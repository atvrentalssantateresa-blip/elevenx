import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { Connection, PublicKey, SystemProgram } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'node:buffer';

function getSolanaConfig() {
  let rawUrl = Deno.env.get('SOLANA_RPC_URL') || '';
  if (rawUrl.includes('RPC_URL=')) {
    rawUrl = rawUrl.split('RPC_URL=')[1].trim();
  }
  if (!rawUrl.startsWith('http') || rawUrl.includes('uuid')) {
    rawUrl = 'https://api.mainnet-beta.solana.com';
  }
  const rpcUrl = rawUrl;
  const programIdStr = Deno.env.get('ELEVENX_PROGRAM_ID') || '';
  if (!programIdStr) throw new Error('ELEVENX_PROGRAM_ID secret not set');
  return { rpcUrl, programIdStr, programId: new PublicKey(programIdStr), connection: new Connection(rpcUrl, 'confirmed') };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Auth: Check platform user OR wallet JWT
    let walletAddress = null;
    
    try {
      const user = await base44.auth.me();
      if (user && user.role === 'admin') {
        // Platform admin - proceed
      } else {
        throw new Error('Not platform admin');
      }
    } catch (_) {
      const authHeader = req.headers.get('Authorization') || '';
      const token = authHeader.replace('Bearer ', '');
      
      if (token && token.split('.').length === 3) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
          walletAddress = payload.walletAddress;
        } catch (_) {}
      }
      
      if (!walletAddress) {
        return Response.json({ error: 'Authentication required' }, { status: 403 });
      }
    }
    
    if (walletAddress) {
      const walletUsers = await base44.asServiceRole.entities.WalletUser.filter({ wallet_address: walletAddress });
      if (!walletUsers[0] || walletUsers[0].role !== 'admin') {
        return Response.json({ error: 'Admin only' }, { status: 403 });
      }
    }

    const { rpcUrl, programIdStr, programId, connection } = getSolanaConfig();
    const [platformPda] = PublicKey.findProgramAddressSync([Buffer.from('platform')], programId);

    // Fetch all bets with solana_market_pda
    const allBets = await base44.asServiceRole.entities.Bet.filter({ solana_market_pda: { $exists: true } });
    const allMatches = await base44.asServiceRole.entities.Match.filter({});
    const matchMap = new Map(allMatches.map(m => [m.id, m]));
    
    console.log(`[cleanupDuplicateMarkets] Scanning ${allBets.length} bets with PDAs...`);
    
    const duplicates = [];
    const validMarkets = new Map(); // team_key -> first valid PDA
    
    for (const bet of allBets) {
      if (!bet.solana_market_pda || !matchMap.has(bet.match_id)) continue;
      
      const match = matchMap.get(bet.match_id);
      const teamKey = `${match.team_a.toLowerCase().trim()}|${match.team_b.toLowerCase().trim()}`;
      
      try {
        const marketPda = new PublicKey(bet.solana_market_pda);
        const marketInfo = await connection.getAccountInfo(marketPda);
        
        if (!marketInfo) {
          console.log(`[cleanupDuplicateMarkets] ☠️ ${bet.match_id} - PDA ${bet.solana_market_pda} not found on-chain`);
          continue;
        }
        
        const data = marketInfo.data;
        const oracleOddsA = Number(data.readBigUInt64LE(156));
        const oracleOddsB = Number(data.readBigUInt64LE(164));
        const oracleOddsDraw = Number(data.readBigUInt64LE(172));
        
        const chainTeamA = new TextDecoder().decode(data.slice(40, 72)).replace(/\0/g, '').trim();
        const chainTeamB = new TextDecoder().decode(data.slice(72, 103)).replace(/\0/g, '').trim();
        
        const isDead = oracleOddsA === 0 && oracleOddsB === 0 && oracleOddsDraw === 0;
        const teamMismatch = chainTeamA !== match.team_a || chainTeamB !== match.team_b;
        
        const marketInfo_obj = {
          bet_id: bet.id,
          match_id: bet.match_id,
          pda: bet.solana_market_pda,
          teamKey,
          isDead,
          teamMismatch,
          chainTeamA,
          chainTeamB,
          dbTeamA: match.team_a,
          dbTeamB: match.team_b,
          lamports: marketInfo.lamports,
        };
        
        // Check if this is a duplicate (same team combination already has a valid PDA)
        if (validMarkets.has(teamKey)) {
          const existing = validMarkets.get(teamKey);
          console.log(`[cleanupDuplicateMarkets] 🔄 DUPLICATE ${teamKey}: ${bet.solana_market_pda} (existing: ${existing.pda})`);
          
          // Mark this as duplicate to close
          duplicates.push({
            ...marketInfo_obj,
            reason: 'duplicate',
            existingPda: existing.pda,
          });
        } else if (isDead) {
          console.log(`[cleanupDuplicateMarkets] ☠️ DEAD ${bet.match_id} - ${bet.solana_market_pda} (odds=[0,0,0])`);
          duplicates.push({
            ...marketInfo_obj,
            reason: 'dead',
          });
        } else if (teamMismatch) {
          console.log(`[cleanupDuplicateMarkets] ⚠️ FAKE ${bet.match_id} - ${bet.solana_market_pda} (teams: ${chainTeamA} vs ${chainTeamB}, expected: ${match.team_a} vs ${match.team_b})`);
          duplicates.push({
            ...marketInfo_obj,
            reason: 'fake',
          });
        } else {
          console.log(`[cleanupDuplicateMarkets] ✓ VALID ${bet.match_id} - ${bet.solana_market_pda}`);
          validMarkets.set(teamKey, marketInfo_obj);
        }
      } catch (err) {
        console.error(`[cleanupDuplicateMarkets] Error checking ${bet.solana_market_pda}:`, err.message);
      }
    }
    
    console.log(`[cleanupDuplicateMarkets] Summary: ${validMarkets.size} valid markets, ${duplicates.length} duplicates/fake/dead`);
    
    if (duplicates.length === 0) {
      return Response.json({
        success: true,
        message: '✓ No duplicates found!',
        validCount: validMarkets.size,
        duplicateCount: 0,
        needsSigning: false,
      });
    }
    
    // Return first duplicate to close
    const toClose = duplicates[0];
    console.log(`[cleanupDuplicateMarkets] Closing ${toClose.pda} (reason: ${toClose.reason})`);
    
    // Build close_market instruction
    const closeDiscriminator = Buffer.from([248, 205, 180, 59, 243, 153, 139, 186]); // SHA256("global:close_market").slice(0, 8)
    const closeData = Buffer.concat([closeDiscriminator, Buffer.alloc(0)]);
    
    const keys = [
      { pubkey: toClose.pda, isSigner: false, isWritable: true }, // market
      { pubkey: platformPda.toBase58(), isSigner: false, isWritable: false }, // platform_config
      { pubkey: 'SIGNER_WALLET', isSigner: true, isWritable: false }, // admin
      { pubkey: SystemProgram.programId.toBase58(), isSigner: false, isWritable: false }, // system_program
    ];
    
    return Response.json({
      success: true,
      message: `Close ${toClose.reason} market: ${toClose.pda} (${toClose.dbTeamA} vs ${toClose.dbTeamB}). ${duplicates.length - 1} remaining.`,
      validCount: validMarkets.size,
      duplicateCount: duplicates.length,
      remaining: duplicates.length - 1,
      needsSigning: true,
      solana_instruction: {
        instruction_type: 'close_market',
        programId: programIdStr,
        rpcUrl,
        keys,
        accounts: {
          market: toClose.pda,
          platformConfig: platformPda.toBase58(),
          admin: 'SIGNER_WALLET',
          systemProgram: SystemProgram.programId.toBase58(),
        },
        instruction_data: closeData.toString('base64'),
      },
      market_pda: toClose.pda,
      bet_id: toClose.bet_id,
      reason: toClose.reason,
    });

  } catch (error) {
    console.error('cleanupDuplicateMarkets error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});