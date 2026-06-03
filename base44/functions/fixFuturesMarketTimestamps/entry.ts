import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { Connection, PublicKey, SystemProgram } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'node:buffer';
import { sha256 } from 'npm:@noble/hashes@1.4.0/sha256';

const SOLANA_PROGRAM_ID = Deno.env.get('SOLANA__PROGRAM_ID') || '4epUYJPwoPhG9RPoQ6qT9dsAewJCDBSCGUpR1Xj9UxTm';
const SOLANA_RPC_URL = 'https://api.devnet.solana.com';

/**
 * Fix futures market timestamps - sets open_until to 30 days from now, settle_after to 31 days
 * This is a testing utility to allow LP and betting on futures markets.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const serviceRole = base44.asServiceRole;

    const payload = await req.json();
    const { futures_market_id } = payload;

    if (!futures_market_id) {
      return Response.json({ error: 'Missing futures_market_id' }, { status: 400 });
    }

    // Fetch futures market from database
    const futuresMarkets = await serviceRole.entities.FuturesMarket.filter({ id: futures_market_id });
    const futuresMarket = futuresMarkets[0];
    if (!futuresMarket) return Response.json({ error: 'Futures market not found' }, { status: 404 });

    const programId = new PublicKey(SOLANA_PROGRAM_ID);
    
    // Derive PDA for futures market
    const marketIdBytes = Buffer.alloc(32);
    Buffer.from(futures_market_id, 'utf-8').copy(marketIdBytes, 0, 0, Math.min(futures_market_id.length, 32));

    const [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('market'), marketIdBytes],
      programId
    );

    // Calculate new timestamps - 30 days from now for testing
    const now = Math.floor(Date.now() / 1000);
    const openUntil = now + (30 * 24 * 60 * 60); // 30 days
    const settleAfter = now + (31 * 24 * 60 * 60); // 31 days
    
    console.log('[fixFuturesMarketTimestamps] New timestamps:', {
      openUntil,
      settleAfter,
      openUntilIso: new Date(openUntil * 1000).toISOString(),
      settleAfterIso: new Date(settleAfter * 1000).toISOString(),
    });

    // Build instruction data for update_market_timestamps
    const discriminator = Buffer.from(sha256("global:update_market_timestamps")).slice(0, 8);
    const data = Buffer.alloc(24);
    discriminator.copy(data, 0);
    data.writeBigInt64LE(BigInt(openUntil), 8);
    data.writeBigInt64LE(BigInt(settleAfter), 16);

    const [platformConfigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('platform')],
      programId
    );

    return Response.json({
      success: true,
      message: 'Update futures market timestamps',
      solana_instruction: {
        instruction_type: 'update_market_timestamps',
        programId: SOLANA_PROGRAM_ID,
        keys: [
          { pubkey: marketPda.toBase58(), isSigner: false, isWritable: true },
          { pubkey: platformConfigPda.toBase58(), isSigner: false, isWritable: false },
          { pubkey: 'SIGNER_WALLET', isSigner: true, isWritable: false },
          { pubkey: '11111111111111111111111111111111', isSigner: false, isWritable: false },
        ],
        instruction_data: data.toString('base64'),
      },
      timestamps: {
        open_until: new Date(openUntil * 1000).toISOString(),
        settle_after: new Date(settleAfter * 1000).toISOString(),
      },
    });

  } catch (error) {
    console.error('fixFuturesMarketTimestamps error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});