import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { Connection, PublicKey } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'node:buffer';

/**
 * Fetch on-chain BetMarket account state for settlement status.
 * Returns settled, voided, and winning_outcome flags directly from chain.
 * 
 * Market layout (after 8-byte discriminator):
 *   ... various fields ...
 *   winning_outcome: u8 at offset 155 (0=unsettled, 1=TeamA, 2=TeamB, 3=Draw)
 *   settled: bool at offset 276
 *   voided: bool at offset 277
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const SOLANA_PROGRAM_ID = Deno.env.get('SOLANA_PROGRAM_ID');
    const SOLANA_RPC_URL = Deno.env.get('SOLANA_RPC_URL') || 'https://api.devnet.solana.com';
    
    if (!SOLANA_PROGRAM_ID) {
      return Response.json({ error: 'SOLANA_PROGRAM_ID not configured' }, { status: 500 });
    }
    
    const payload = await req.json();
    const { market_pda } = payload;
    
    if (!market_pda) {
      return Response.json({ error: 'Missing market_pda' }, { status: 400 });
    }
    
    const programId = new PublicKey(SOLANA_PROGRAM_ID);
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
    const marketPubkey = new PublicKey(market_pda);
    
    console.log('[checkMarketState] Fetching market:', marketPubkey.toBase58());
    
    const accountInfo = await connection.getAccountInfo(marketPubkey);
    
    if (!accountInfo) {
      return Response.json({ 
        error: 'Market not found on-chain',
        settled: false,
        voided: false,
        winning_outcome: null,
      }, { status: 404 });
    }
    
    const data = accountInfo.data;
    console.log('[checkMarketState] Account data length:', data.length);
    
    // Validate minimum size
    if (data.length < 278) {
      console.log('[checkMarketState] Account data too small:', data.length);
      return Response.json({
        error: 'Invalid account data size',
        settled: false,
        voided: false,
        winning_outcome: null,
      });
    }
    
    // Read settlement fields
    const WINNING_OUTCOME_OFFSET = 155; // u8: 0=unsettled, 1=a, 2=b, 3=draw
    const SETTLED_OFFSET = 276;         // bool
    const VOIDED_OFFSET = 277;          // bool
    
    const winningOutcomeRaw = data[WINNING_OUTCOME_OFFSET];
    const settled = data[SETTLED_OFFSET] === 1;
    const voided = data[VOIDED_OFFSET] === 1;
    
    // Map winning_outcome u8 to outcome label
    let winningOutcome = null;
    if (winningOutcomeRaw === 1) winningOutcome = 'a';
    else if (winningOutcomeRaw === 2) winningOutcome = 'b';
    else if (winningOutcomeRaw === 3) winningOutcome = 'draw';
    
    console.log('[checkMarketState] On-chain state:', {
      settled,
      voided,
      winning_outcome: winningOutcome,
      winning_outcome_raw: winningOutcomeRaw,
    });
    
    return Response.json({
      success: true,
      settled,
      voided,
      winning_outcome: winningOutcome,
      winning_outcome_raw: winningOutcomeRaw,
      account_size: data.length,
    });
    
  } catch (error) {
    console.error('[checkMarketState] Error:', error);
    return Response.json({ 
      error: error.message,
      settled: false,
      voided: false,
      winning_outcome: null,
    }, { status: 500 });
  }
});