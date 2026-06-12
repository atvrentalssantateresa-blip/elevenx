import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { Connection, PublicKey, SystemProgram } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'node:buffer';
import { sha256 } from 'npm:@noble/hashes@1.4.0/sha256';

function getSolanaConfig() {
  let rawUrl = Deno.env.get('SOLANA_RPC_URL') || '';
  
  // Handle malformed secret (e.g., "RPC_URL=..." or UUID)
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
    const body = await req.clone().json().catch(() => ({}));
    const { market_pda } = body;

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

    const { rpcUrl, programIdStr, programId, connection } = getSolanaConfig();
    const [platformPda] = PublicKey.findProgramAddressSync([Buffer.from('platform')], programId);

    // Validate market PDA
    if (!market_pda) {
      return Response.json({ error: 'market_pda required' }, { status: 400 });
    }

    const marketPubkey = new PublicKey(market_pda);
    const marketInfo = await connection.getAccountInfo(marketPubkey);
    
    if (!marketInfo) {
      return Response.json({ error: 'Market account not found on-chain' }, { status: 404 });
    }

    // Parse market account data to check oracle_odds
    // BetMarket layout: discriminator (8) + match_id (32) + outcome_names (96) + open_until (8) + settle_after (8) + fee_percent (2) + outcome_count (1) + winning_outcome (1) + oracle_odds (24) + ...
    const data = marketInfo.data;
    if (data.length < 172) {
      return Response.json({ error: 'Invalid market account size' }, { status: 400 });
    }

    // Read oracle_odds at offset 156 (8+32+96+8+8+2+1+1 = 156)
    const oddsA = data.readBigUInt64LE(156);
    const oddsB = data.readBigUInt64LE(164);
    const oddsDraw = data.readBigUInt64LE(172);

    console.log('[closeMarket] Market PDA:', market_pda);
    console.log('[closeMarket] Oracle odds:', { oddsA: oddsA.toString(), oddsB: oddsB.toString(), oddsDraw: oddsDraw.toString() });

    // Check if this is a dead market (all odds = 0)
    if (oddsA !== 0n || oddsB !== 0n || oddsDraw !== 0n) {
      return Response.json({ 
        error: 'Market is not dead (oracle_odds != [0,0,0]). This instruction is only for recovering from bad CLI script.',
        odds: { oddsA: oddsA.toString(), oddsB: oddsB.toString(), oddsDraw: oddsDraw.toString() }
      }, { status: 400 });
    }

    // Build close_market instruction
    const discriminator = Buffer.from(sha256('global:close_market')).slice(0, 8);
    const instructionData = discriminator; // No params

    const keys = [
      { pubkey: market_pda, isSigner: false, isWritable: true },
      { pubkey: platformPda.toBase58(), isSigner: false, isWritable: false },
      { pubkey: 'SIGNER_WALLET', isSigner: true, isWritable: false },
    ];

    const accounts = {
      market: market_pda,
      platformConfig: platformPda.toBase58(),
      admin: 'SIGNER_WALLET',
    };

    console.log('[closeMarket] Instruction data (hex):', instructionData.toString('hex'));

    return Response.json({
      success: true,
      solana_instruction: {
        instruction_type: 'close_market',
        programId: programIdStr,
        rpcUrl,
        keys,
        accounts,
        instruction_data: instructionData.toString('base64'),
      },
      message: 'Sign transaction to close dead market',
    });

  } catch (error) {
    console.error('[closeMarket] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});