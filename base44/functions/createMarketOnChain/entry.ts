import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { PublicKey, SystemProgram } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'node:buffer';
import { sha256 } from 'npm:@noble/hashes@1.4.0/sha256';

/**
 * create_market instruction builder
 * Discriminator: [103, 226, 97, 235, 200, 188, 251, 254]
 * Data: discriminator + match_id (32) + outcome_names (3x32) + open_until (i64) + settle_after (i64) + fee_override (Option<u16>) + outcome_count (u8) + oracle_odds (3x u64)
 * Accounts: market, vote_tally, platform_config, admin, system_program
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const SOLANA_PROGRAM_ID = Deno.env.get('SOLANA_PROGRAM_ID');
    
    if (!SOLANA_PROGRAM_ID) {
      return Response.json({ error: 'Solana program ID not configured' }, { status: 500 });
    }
    
    const { bet_id, match_id } = await req.json();
    if (!bet_id || !match_id) {
      return Response.json({ error: 'Missing bet_id or match_id' }, { status: 400 });
    }

    const bets = await base44.entities.Bet.filter({ id: bet_id });
    const bet = bets[0];
    if (!bet) return Response.json({ error: 'Bet not found' }, { status: 404 });

    const matches = await base44.entities.Match.filter({ id: match_id });
    const match = matches[0];
    if (!match) return Response.json({ error: 'Match not found' }, { status: 404 });

    const programId = new PublicKey(SOLANA_PROGRAM_ID);
    const matchIdBytes = Buffer.alloc(32);
    Buffer.from(match_id, 'utf-8').copy(matchIdBytes, 0, 0, Math.min(match_id.length, 32));

    const [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('market'), matchIdBytes],
      programId
    );

    const [voteTallyPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vote_tally'), marketPda.toBuffer()],
      programId
    );

    const [platformPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('platform')],
      programId
    );

    const [feeVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('fee_vault')],
      programId
    );

    // Build instruction data
    const discriminator = Buffer.from([103, 226, 97, 235, 200, 188, 251, 254]);
    
    const isTestMarket = bet.title?.toLowerCase().includes('test');
    const bettingCloseTime = new Date(bet.open_until).getTime();
    const openUntil = Math.floor(bettingCloseTime / 1000);
    const settleAfter = isTestMarket ? openUntil + 1 : openUntil + 300;

    const outcomeNames = [
      Buffer.alloc(32),
      Buffer.alloc(32),
      Buffer.alloc(32),
    ];
    Buffer.from(bet.outcome_a || 'A').copy(outcomeNames[0], 0, 0, Math.min(bet.outcome_a?.length || 1, 32));
    Buffer.from(bet.outcome_b || 'B').copy(outcomeNames[1], 0, 0, Math.min(bet.outcome_b?.length || 1, 32));
    Buffer.from(bet.outcome_draw || 'Draw').copy(outcomeNames[2], 0, 0, Math.min(bet.outcome_draw?.length || 4, 32));

    // Params: 32 + 96 + 8 + 8 + 3 + 1 + 24 = 172 bytes
    const paramsData = Buffer.alloc(172);
    let offset = 0;
    
    matchIdBytes.copy(paramsData, offset);
    offset += 32;
    
    outcomeNames[0].copy(paramsData, offset);
    offset += 32;
    outcomeNames[1].copy(paramsData, offset);
    offset += 32;
    outcomeNames[2].copy(paramsData, offset);
    offset += 32;
    
    paramsData.writeBigInt64LE(BigInt(openUntil), offset);
    offset += 8;
    
    paramsData.writeBigInt64LE(BigInt(settleAfter), offset);
    offset += 8;
    
    paramsData.writeUInt8(1, offset); // flag = Some
    offset += 1;
    paramsData.writeUInt16LE(bet.fee_percent || 200, offset);
    offset += 2;
    
    paramsData.writeUInt8(3, offset); // outcome_count
    offset += 1;
    
    const oddsA = BigInt(Math.round((bet.odds_a || bet.oracle_odds_a || 0) * 100));
    const oddsB = BigInt(Math.round((bet.odds_b || bet.oracle_odds_b || 0) * 100));
    const oddsDraw = BigInt(Math.round((bet.odds_draw || bet.oracle_odds_draw || 0) * 100));
    paramsData.writeBigUInt64LE(oddsA, offset);
    offset += 8;
    paramsData.writeBigUInt64LE(oddsB, offset);
    offset += 8;
    paramsData.writeBigUInt64LE(oddsDraw, offset);
    offset += 8;

    const instructionData = Buffer.concat([discriminator, paramsData]);

    console.log('[createMarketOnChain] Discriminator (bytes):', Array.from(discriminator));
    console.log('[createMarketOnChain] Discriminator (hex):', discriminator.toString('hex'));
    console.log('[createMarketOnChain] Market PDA:', marketPda.toBase58());

    // Build accounts in exact order:
    // 1. market [writable]
    // 2. vote_tally [writable]
    // 3. platform_config [writable]
    // 4. admin [signer, writable]
    // 5. system_program [readonly]
    const keys = [
      { pubkey: marketPda.toBase58(), isSigner: false, isWritable: true },
      { pubkey: voteTallyPda.toBase58(), isSigner: false, isWritable: true },
      { pubkey: platformPda.toBase58(), isSigner: false, isWritable: true },
      { pubkey: 'SIGNER_WALLET', isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId.toBase58(), isSigner: false, isWritable: false },
    ];

    console.log('[createMarketOnChain] Accounts:');
    keys.forEach((k, i) => {
      console.log(`  [${i}] ${k.pubkey} (isSigner: ${k.isSigner}, isWritable: ${k.isWritable})`);
    });

    return Response.json({
      success: true,
      marketPda: marketPda.toBase58(),
      platformPda: platformPda.toBase58(),
      feeVaultPda: feeVaultPda.toBase58(),
      solana_instruction: {
        instruction_type: 'create_market',
        programId: SOLANA_PROGRAM_ID,
        keys,
        instruction_data: instructionData.toString('base64'),
      },
      message: 'Sign transaction to create market',
    });

  } catch (error) {
    console.error('[createMarketOnChain] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});