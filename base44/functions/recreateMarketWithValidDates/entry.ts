import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { Connection, PublicKey, SystemProgram } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'node:buffer';
import { sha256 } from 'npm:@noble/hashes@1.4.0/sha256';

const SOLANA_PROGRAM_ID = Deno.env.get('SOLANA__PROGRAM_ID') || 'PMut1111111111111111111111111111111111111111';
const SOLANA_RPC_URL = 'https://api.devnet.solana.com';

/**
 * Recreate a market with valid timestamps (bypasses corrupted open_until check).
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const payload = await req.json();
    const { bet_id, match_id } = payload;

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

    const [platformConfigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('platform')],
      programId
    );

    // Set valid timestamps: open_until = 24 hours from now, settle_after = 25 hours from now
    const openUntil = Math.floor(Date.now() / 1000) + 86400;
    const settleAfter = openUntil + 3600;

    const outcomeNames = [
      Buffer.alloc(32),
      Buffer.alloc(32),
      Buffer.alloc(32),
    ];
    Buffer.from(bet.outcome_a || 'A').copy(outcomeNames[0], 0, 0, Math.min(bet.outcome_a?.length || 1, 32));
    Buffer.from(bet.outcome_b || 'B').copy(outcomeNames[1], 0, 0, Math.min(bet.outcome_b?.length || 1, 32));
    Buffer.from(bet.outcome_draw || 'Draw').copy(outcomeNames[2], 0, 0, Math.min(bet.outcome_draw?.length || 4, 32));

    const discriminator = Buffer.from(sha256("global:create_market")).slice(0, 8);

    const paramsData = Buffer.alloc(171);
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
    
    paramsData.writeUInt16LE(bet.fee_percent || 200, offset);
    offset += 2;
    
    paramsData.writeUInt8(3, offset);
    offset += 1;
    
    const oddsA = BigInt(Math.round((bet.odds_a || 210) * 100));
    const oddsB = BigInt(Math.round((bet.odds_b || 210) * 100));
    const oddsDraw = BigInt(Math.round((bet.odds_draw || 210) * 100));
    paramsData.writeBigUInt64LE(oddsA, offset);
    offset += 8;
    paramsData.writeBigUInt64LE(oddsB, offset);
    offset += 8;
    paramsData.writeBigUInt64LE(oddsDraw, offset);
    offset += 8;

    const instructionData = Buffer.concat([discriminator, paramsData]);

    return Response.json({
      success: true,
      marketPda: marketPda.toBase58(),
      solana_instruction: {
        instruction_type: 'create_market',
        programId: SOLANA_PROGRAM_ID,
        marketPda: marketPda.toBase58(),
        instruction_data: instructionData.toString('base64'),
        accounts: {
          market: marketPda.toBase58(),
          voteTally: voteTallyPda.toBase58(),
          platformConfig: platformConfigPda.toBase58(),
          payer: '',
          systemProgram: '11111111111111111111111111111111',
        }
      },
      message: 'Sign to recreate market with valid timestamps (open_until=24h from now)',
    });

  } catch (error) {
    console.error('recreateMarketWithValidDates error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});