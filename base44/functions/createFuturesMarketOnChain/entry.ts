import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { Connection, PublicKey, SystemProgram } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'node:buffer';
import { sha256 } from 'npm:@noble/hashes@1.4.0/sha256';

const SOLANA_PROGRAM_ID = Deno.env.get('SOLANA_PROGRAM_ID') || '4epUYJPwoPhG9RPoQ6qT9dsAewJCDBSCGUpR1Xj9UxTm';
const SOLANA_RPC_URL = 'https://api.devnet.solana.com';

/**
 * Creates a futures market on-chain for tournament-wide bets (World Cup Winner, Golden Boot, etc.)
 * Uses the same market structure but with tournament-specific timestamps.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const serviceRole = base44.asServiceRole;
    
    const payload = await req.json();
    const { futures_market_id } = payload;

    console.log('[createFuturesMarketOnChain] Request payload:', payload);

    if (!futures_market_id) {
      console.error('[createFuturesMarketOnChain] Missing futures_market_id');
      return Response.json({ error: 'Missing futures_market_id' }, { status: 400 });
    }

    // Fetch futures market from database
    const futuresMarkets = await base44.entities.FuturesMarket.filter({ id: futures_market_id });
    const futuresMarket = futuresMarkets[0];
    console.log('[createFuturesMarketOnChain] Futures market:', {
      id: futuresMarket?.id,
      title: futuresMarket?.title,
      outcomes: futuresMarket?.outcomes?.length,
      outcomes_data: futuresMarket?.outcomes,
    });
    
    if (!futuresMarket) {
      console.error('[createFuturesMarketOnChain] Futures market not found:', futures_market_id);
      return Response.json({ error: 'Futures market not found' }, { status: 404 });
    }

    // Validate: Solana program only supports exactly 3 outcomes
    if (!futuresMarket.outcomes || futuresMarket.outcomes.length < 3) {
      console.error('[createFuturesMarketOnChain] Invalid outcomes:', futuresMarket.outcomes);
      return Response.json({ error: 'Futures market must have exactly 3 outcomes' }, { status: 400 });
    }

    const programId = new PublicKey(SOLANA_PROGRAM_ID);
    
    // Derive PDA for futures market using market ID as seed
    const marketIdBytes = Buffer.alloc(32);
    Buffer.from(futures_market_id, 'utf-8').copy(marketIdBytes, 0, 0, Math.min(futures_market_id.length, 32));

    const [marketPda, marketBump] = PublicKey.findProgramAddressSync(
      [Buffer.from('market'), marketIdBytes],
      programId
    );

    // Derive vote tally PDA - uses market's public key as seed (not match_id)
    const [voteTallyPda, voteTallyBump] = PublicKey.findProgramAddressSync(
      [Buffer.from('vote_tally'), marketPda.toBuffer()],
      programId
    );

    console.log('PDA derivation:', {
      marketPda: marketPda.toBase58(),
      marketBump,
      voteTallyPda: voteTallyPda.toBase58(),
      voteTallyBump,
      programId: programId.toBase58(),
    });

    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
    const accountInfo = await connection.getAccountInfo(marketPda);
    
    if (accountInfo) {
      const expectedMinSize = 210;
      if (accountInfo.data.length >= expectedMinSize) {
        console.log('Futures market already exists at:', marketPda.toBase58());
        return Response.json({
          success: true,
          marketPda: marketPda.toBase58(),
          alreadyExists: true,
        });
      }
    }

    // Calculate timestamps based on market type
    // CRITICAL: Check if this is a TEST market (title contains "Test" or "Quick Test")
    // Test markets should use their DB timeline, NOT World Cup Final dates
    const isTestMarket = futuresMarket.title?.toLowerCase().includes('test') || 
                         futuresMarket.subtitle?.toLowerCase().includes('test');
    
    // World Cup Final: July 19, 2026, 1:00 PM Costa Rica time (UTC-6) = 19:00 UTC
    const WORLD_CUP_FINAL_KICKOFF = new Date('2026-07-19T13:00:00-06:00');
    const WORLD_CUP_FINAL_ENDS = new Date('2026-07-19T15:00:00-06:00');
    
    let openUntil, settleAfter;
    
    if (isTestMarket) {
      // TEST MARKET: Use the timeline from the database (open_until field)
      // This allows test markets to settle immediately after their short betting window
      const dbOpenUntil = new Date(futuresMarket.open_until);
      openUntil = Math.floor(dbOpenUntil.getTime() / 1000);
      // Settle 1 minute after betting closes (for test markets)
      settleAfter = openUntil + 60;
      console.log('[createFuturesMarketOnChain] TEST market detected - using DB timeline:', {
        openUntil: new Date(openUntil * 1000).toISOString(),
        settleAfter: new Date(settleAfter * 1000).toISOString(),
      });
    } else if (futuresMarket.category === 'tournament') {
      // PRODUCTION tournament-wide markets (Winner, To Reach Final) close at final kickoff
      openUntil = Math.floor(WORLD_CUP_FINAL_KICKOFF.getTime() / 1000);
      settleAfter = Math.floor(WORLD_CUP_FINAL_ENDS.getTime() / 1000);
    } else if (futuresMarket.category === 'player') {
      // PRODUCTION Golden Boot closes at final end time
      openUntil = Math.floor(WORLD_CUP_FINAL_ENDS.getTime() / 1000);
      settleAfter = openUntil + 7200; // 2 hours after for settlement
    } else {
      // Default: 24 hours from now for testing
      openUntil = Math.floor(Date.now() / 1000) + 86400;
      settleAfter = openUntil + 7200;
    }

    // Validate timestamps
    const now = Math.floor(Date.now() / 1000);
    if (openUntil <= now) {
      return Response.json({ error: 'Market open_until must be in the future' }, { status: 400 });
    }
    if (settleAfter <= openUntil) {
      return Response.json({ error: 'settle_after must be after open_until' }, { status: 400 });
    }

    // Hardcoded discriminator matching deployed program (same as createMarketOnChain)
    const discriminator = Buffer.from([103, 226, 97, 235, 200, 188, 251, 254]);

    const outcomeNames = [Buffer.alloc(32), Buffer.alloc(32), Buffer.alloc(32)];
    for (let i = 0; i < 3; i++) {
      const label = futuresMarket.outcomes?.[i]?.label || `Outcome ${i + 1}`;
      Buffer.from(label, 'utf-8').copy(outcomeNames[i], 0, 0, Math.min(label.length, 32));
    }

    // match_id (32 bytes) — use futures market ID as seed
    const matchIdBytes = Buffer.alloc(32);
    Buffer.from(futures_market_id, 'utf-8').copy(matchIdBytes, 0, 0, Math.min(futures_market_id.length, 32));

    // fee as Option<u16>: 0x01 + u16 LE (same encoding as createMarketOnChain)
    const feeOptionBuf = Buffer.alloc(3);
    feeOptionBuf.writeUInt8(1, 0);
    feeOptionBuf.writeUInt16LE(0, 1); // 0% fee

    // oracle_odds: must be > 100 (100 = 1.0x)
    const oddsArr = [0, 1, 2].map(i => Math.max(Math.round((futuresMarket.outcomes?.[i]?.odds || 2.0) * 100), 101));

    // Build params: 32 + 96 + 8 + 8 + 3 + 1 + 24 = 172 bytes (matches createMarketOnChain)
    const paramsData = Buffer.alloc(172);
    let offset = 0;
    matchIdBytes.copy(paramsData, offset); offset += 32;
    outcomeNames[0].copy(paramsData, offset); offset += 32;
    outcomeNames[1].copy(paramsData, offset); offset += 32;
    outcomeNames[2].copy(paramsData, offset); offset += 32;
    paramsData.writeBigInt64LE(BigInt(openUntil), offset); offset += 8;
    paramsData.writeBigInt64LE(BigInt(settleAfter), offset); offset += 8;
    feeOptionBuf.copy(paramsData, offset); offset += 3;
    paramsData.writeUInt8(3, offset); offset += 1; // outcome_count = 3
    paramsData.writeBigUInt64LE(BigInt(oddsArr[0]), offset); offset += 8;
    paramsData.writeBigUInt64LE(BigInt(oddsArr[1]), offset); offset += 8;
    paramsData.writeBigUInt64LE(BigInt(oddsArr[2]), offset); offset += 8;

    const instructionData = Buffer.concat([discriminator, paramsData]);

    console.log('Futures Market PDA:', marketPda.toBase58());
    console.log('Instruction data length:', instructionData.length);
    console.log('Open until:', new Date(openUntil * 1000).toISOString());
    console.log('Settle after:', new Date(settleAfter * 1000).toISOString());

    const [platformConfigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('platform')],
      programId
    );

    const platformConfigInfo = await connection.getAccountInfo(platformConfigPda);
    if (!platformConfigInfo) {
      const [feeVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('fee_vault')],
        programId
      );
      
      const initDiscriminator = Buffer.from(sha256("global:initialize_platform")).slice(0, 8);
      const initParams = Buffer.alloc(3);
      initParams.writeUInt16LE(0, 0);
      initParams.writeUInt8(51, 2);
      const initInstructionData = Buffer.concat([initDiscriminator, initParams]);
      
      return Response.json({
        success: false,
        error: 'Platform config not initialized',
        needsPlatformInit: true,
        solana_instruction: {
          instruction_type: 'initialize_platform',
          programId: SOLANA_PROGRAM_ID,
          instruction_data: initInstructionData.toString('base64'),
          accounts: {
            platformConfig: platformConfigPda.toBase58(),
            feeVault: feeVaultPda.toBase58(),
            admin: '',
          }
        }
      });
    }

    // Save only the PDA to DB - DO NOT set solana_market_created: true yet
    // The frontend will set solana_market_created: true AFTER successful signing
    await serviceRole.entities.FuturesMarket.update(futures_market_id, {
      solana_market_pda: marketPda.toBase58(),
    });
    console.log('[createFuturesMarketOnChain] Saved solana_market_pda to DB:', marketPda.toBase58());

    console.log('[createFuturesMarketOnChain] Instruction data length:', instructionData.length, '(expected 180)');

    const keys = [
      { pubkey: marketPda.toBase58(), isSigner: false, isWritable: true },
      { pubkey: voteTallyPda.toBase58(), isSigner: false, isWritable: true },
      { pubkey: platformConfigPda.toBase58(), isSigner: false, isWritable: true },
      { pubkey: 'SIGNER_WALLET', isSigner: true, isWritable: true },
      { pubkey: '11111111111111111111111111111111', isSigner: false, isWritable: false },
    ];
    const accounts = {
      market: marketPda.toBase58(),
      voteTally: voteTallyPda.toBase58(),
      platformConfig: platformConfigPda.toBase58(),
      admin: 'SIGNER_WALLET',
      systemProgram: '11111111111111111111111111111111',
    };

    return Response.json({
      success: true,
      marketPda: marketPda.toBase58(),
      alreadyExists: false,
      solana_instruction: {
        instruction_type: 'create_market',
        programId: SOLANA_PROGRAM_ID,
        marketPda: marketPda.toBase58(),
        instruction_data: instructionData.toString('base64'),
        keys,
        accounts,
        futures_market_id: futures_market_id,
      },
      message: 'Sign to create futures market on-chain',
      futures_market_id: futures_market_id,
    });

  } catch (error) {
    console.error('createFuturesMarketOnChain error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});