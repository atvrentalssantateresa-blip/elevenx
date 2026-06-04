import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { Connection, PublicKey } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'node:buffer';
import { sha256 } from 'npm:@noble/hashes@1.4.0/sha256';

const SOLANA_PROGRAM_ID = Deno.env.get('SOLANA__PROGRAM_ID') || 'PMut1111111111111111111111111111111111111111';
const SOLANA_RPC_URL = 'https://api.devnet.solana.com';

/**
 * ONE-CLICK SMOOTH TEST: Creates match + bet + market instruction with VALID timestamps.
 * No debugging needed - everything set correctly for instant testing.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const now = Date.now();
    const openUntil = new Date(now + 5 * 60 * 1000); // 5 minutes from now
    const settleAfter = new Date(now + 6 * 60 * 1000); // 6 minutes from now

    // Step 1: Create test match
    const match = await base44.asServiceRole.entities.Match.create({
      team_a: 'test1',
      team_b: 'test2',
      team_a_flag: '🔵',
      team_b_flag: '🔴',
      group_stage: 'Smooth Test',
      match_time: openUntil.toISOString(),
      venue: 'Test Arena',
      status: 'upcoming',
    });

    console.log('[smoothTest] Created match:', match.id);

    // Step 2: Create bet with VALID future timestamps
    const bet = await base44.asServiceRole.entities.Bet.create({
      match_id: match.id,
      title: 'test1 vs test2 - Smooth Test',
      outcome_a: 'test1',
      outcome_b: 'test2',
      outcome_draw: 'Draw',
      open_until: openUntil.toISOString(),
      status: 'open',
      odds_a: 2.0,
      odds_b: 2.0,
      odds_draw: 3.0,
      odds_bookmaker: 'Test',
      odds_updated_at: new Date().toISOString(),
      fee_percent: 0,
    });

    console.log('[smoothTest] Created bet:', bet.id, 'open_until:', openUntil.toISOString());

    // Step 3: Prepare create_market instruction
    const programId = new PublicKey(SOLANA_PROGRAM_ID);
    const matchIdBytes = Buffer.alloc(32);
    Buffer.from(match.id, 'utf-8').copy(matchIdBytes, 0, 0, Math.min(match.id.length, 32));

    const [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('market'), matchIdBytes],
      programId
    );

    const [voteTallyPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vote_tally'), marketPda.toBuffer()],
      programId
    );

    const [platformConfigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('platform')],
      programId
    );

    // Get platform admin from on-chain config
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
    const platformInfo = await connection.getAccountInfo(platformConfigPda);
    if (!platformInfo) {
      return Response.json({ error: 'Platform config not initialized on-chain' }, { status: 400 });
    }
    const adminPubkey = new PublicKey(platformInfo.data.slice(8, 40));
    const admin_wallet = adminPubkey.toBase58();
    console.log('[smoothTest] Platform admin:', admin_wallet);

    // Build create_market instruction data
    const discriminator = Buffer.from(sha256('global:create_market')).slice(0, 8);

    const outcomeNames = [Buffer.alloc(32), Buffer.alloc(32), Buffer.alloc(32)];
    Buffer.from('test1').copy(outcomeNames[0], 0);
    Buffer.from('test2').copy(outcomeNames[1], 0);
    Buffer.from('Draw').copy(outcomeNames[2], 0);

    // Timestamps in seconds (Unix) - MUST be in future!
    const openUntilSec = Math.floor(openUntil.getTime() / 1000);
    const settleAfterSec = Math.floor(settleAfter.getTime() / 1000);

    console.log('[smoothTest] Timestamps:', {
      open_until: openUntilSec,
      open_until_date: openUntil.toISOString(),
      settle_after: settleAfterSec,
      settle_after_date: settleAfter.toISOString(),
    });

    const paramsData = Buffer.alloc(171);
    let offset = 0;

    matchIdBytes.copy(paramsData, offset); offset += 32;
    outcomeNames[0].copy(paramsData, offset); offset += 32;
    outcomeNames[1].copy(paramsData, offset); offset += 32;
    outcomeNames[2].copy(paramsData, offset); offset += 32;
    paramsData.writeBigInt64LE(BigInt(openUntilSec), offset); offset += 8;
    paramsData.writeBigInt64LE(BigInt(settleAfterSec), offset); offset += 8;
    paramsData.writeUInt16LE(0, offset); offset += 2; // 0% fee for testing
    paramsData.writeUInt8(3, offset); offset += 1; // 3 outcomes

    const oddsA = BigInt(Math.round(2.0 * 100));
    const oddsB = BigInt(Math.round(2.0 * 100));
    const oddsDraw = BigInt(Math.round(3.0 * 100));
    paramsData.writeBigUInt64LE(oddsA, offset); offset += 8;
    paramsData.writeBigUInt64LE(oddsB, offset); offset += 8;
    paramsData.writeBigUInt64LE(oddsDraw, offset); offset += 8;

    const instructionData = Buffer.concat([discriminator, paramsData]);

    return Response.json({
      success: true,
      message: '✓ Test ready! Sign transaction to deploy market on-chain (closes in 5 min)',
      match_id: match.id,
      bet_id: bet.id,
      market_pda: marketPda.toBase58(),
      admin_wallet: admin_wallet,
      timestamps: {
        open_until: openUntil.toISOString(),
        settle_after: settleAfter.toISOString(),
        minutes_until_close: 5,
      },
      solana_instruction: {
        instruction_type: 'create_market',
        programId: SOLANA_PROGRAM_ID,
        instruction_data: instructionData.toString('base64'),
        accounts: {
          market: marketPda.toBase58(),
          voteTally: voteTallyPda.toBase58(),
          platformConfig: platformConfigPda.toBase58(),
          admin: admin_wallet,
          systemProgram: '11111111111111111111111111111111',
        },
      },
    });

  } catch (error) {
    console.error('[smoothTest] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});