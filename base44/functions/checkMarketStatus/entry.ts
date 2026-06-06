import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { Connection, PublicKey } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'node:buffer';

// Simple in-memory cache to prevent Solana RPC rate limiting (60-second TTL)
const cache = new Map();
const CACHE_TTL_MS = 60000;

/**
 * Checks if a pari-mutuel market is properly initialized on-chain and whether it's settled.
 * Returns status: 'not_created' | 'not_initialized' | 'initialized' | 'settled'
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const SOLANA_PROGRAM_ID = Deno.env.get('SOLANA_PROGRAM_ID');
    if (!SOLANA_PROGRAM_ID) {
      return Response.json({ error: 'Solana program ID not configured' }, { status: 500 });
    }
    
    const SOLANA_RPC_URL = 'https://api.devnet.solana.com';
    
    const payload = await req.json();
    let { match_id, bet_id } = payload;
    
    // Validate inputs BEFORE cache check
    if (!match_id && !bet_id) {
      console.error('[checkMarketStatus] CRITICAL: No match_id or bet_id provided in payload:', payload);
      return Response.json({ 
        error: 'Missing match_id or bet_id',
        received_payload: payload,
      }, { status: 400 });
    }
    
    // If bet_id is provided, use it to get the match_id
    if (bet_id && !match_id) {
      try {
        const bet = await base44.entities.Bet.get(bet_id);
        if (bet) {
          match_id = bet.match_id;
          console.log('[checkMarketStatus] Got match_id from bet_id:', match_id);
        } else {
          console.error('[checkMarketStatus] Bet not found for bet_id:', bet_id);
        }
      } catch (err) {
        console.error('[checkMarketStatus] Failed to fetch bet:', err.message);
      }
    }
    
    // Final validation
    if (!match_id) {
      console.error('[checkMarketStatus] Still no match_id after lookup. Payload:', payload, 'bet_id:', bet_id);
      return Response.json({ 
        error: 'Could not determine match_id',
        received_payload: payload,
        bet_id_provided: bet_id,
      }, { status: 400 });
    }
    
    // Check cache first (AFTER validation)
    const cacheKey = `market:${match_id}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      console.log('[checkMarketStatus] Cache HIT:', cacheKey);
      return Response.json(cached.data);
    }
    console.log('[checkMarketStatus] Cache MISS:', cacheKey);
    
    const programId = new PublicKey(SOLANA_PROGRAM_ID);
    const matchIdBytes = Buffer.alloc(32);
    Buffer.from(match_id, 'utf-8').copy(matchIdBytes, 0, 0, Math.min(match_id.length, 32));
    
    const [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('market'), matchIdBytes],
      programId
    );
    
    const connection = new Connection(SOLANA_RPC_URL, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 30000,
    });
    
    console.log('[checkMarketStatus] Checking account at PDA:', marketPda.toBase58());
    
    // Retry logic with exponential backoff for rate limiting
    let accountInfo = null;
    let lastError = null;
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        accountInfo = await connection.getAccountInfo(marketPda);
        break; // Success, exit retry loop
      } catch (rpcError) {
        lastError = rpcError;
        console.log(`[checkMarketStatus] RPC attempt ${attempt} failed:`, rpcError.message);
        
        if (rpcError.message?.includes('429') || rpcError.message?.includes('rate limit')) {
          if (attempt < maxRetries) {
            const delayMs = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s
            console.log(`[checkMarketStatus] Rate limited, waiting ${delayMs}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
          } else {
            console.log('[checkMarketStatus] Max retries reached, returning cached/last known state');
          }
        } else {
          throw rpcError; // Non-rate-limit error, rethrow immediately
        }
      }
    }
    
    if (!accountInfo && lastError) {
      throw lastError;
    }
    
    if (!accountInfo) {
      console.log('[checkMarketStatus] Account NOT FOUND - status: not_created');
      return Response.json({
        status: 'not_created',
        marketPda: marketPda.toBase58(),
      });
    }
    
    console.log('[checkMarketStatus] Account FOUND:', {
      size: accountInfo.data.length,
      lamports: accountInfo.lamports,
      owner: accountInfo.owner.toBase58(),
    });
    
    // PoolMarket: 8 (discriminator) + 204 (struct) = 212 bytes
    const expectedMinSize = 212;
    const actualSize = accountInfo.data.length;
    
    if (actualSize < expectedMinSize) {
      console.log('Account too small - size:', actualSize, 'expected:', expectedMinSize);
      // Check if it's a small uninitialized account (just discriminator + bump)
      if (actualSize >= 8) {
        console.log('[checkMarketStatus] Account exists but too small - likely uninitialized');
        return Response.json({
          status: 'not_initialized',
          marketPda: marketPda.toBase58(),
          actualSize,
          expectedMinSize,
          lamports: accountInfo.lamports,
          owner: accountInfo.owner.toBase58(),
        });
      }
      console.log('[checkMarketStatus] Account size invalid - status: not_created');
      return Response.json({
        status: 'not_created',
        marketPda: marketPda.toBase58(),
        actualSize,
        expectedMinSize,
      });
    }
    
    // Parse the account data to read settled status
    // Layout: discriminator(8) + match_id(32) + outcome_names(96) + open_until(8) + settle_after(8) + 
    //         fee_percent(2) + outcome_count(1) + winning_outcome(1) + oracle_odds(24) + 
    //         total_matched(24) + total_pending(24) + total_lp_committed(8) + accrued_fees(8) + 
    //         settled(1) + voided(1) + paused(1) + settlement_finalized(1) + bump(1)
    const data = accountInfo.data;
    const settledOffset = 244; // After accrued_fees
    console.log('[checkMarketStatus] Data length:', data.length);
    console.log('[checkMarketStatus] Checking offsets 204-250 for settled flag:');
    for (let i = 200; i < 250; i++) {
      if (i < data.length) {
        console.log(`  Offset ${i}: ${data[i]} (${data[i] === 1 ? '← POSSIBLE SETTLED' : ''})`);
      }
    }
    const isSettled = data[settledOffset] === 1;
    const isVoided = data[settledOffset + 1] === 1;
    const isPaused = data[settledOffset + 2] === 1;
    const isSettlementFinalized = data[settledOffset + 3] === 1;
    
    // Read winning_outcome (at offset 8 + 32 + 96 + 8 + 8 + 2 + 1 = 155, but we already have it in the struct)
    const winningOutcomeOffset = 8 + 32 + 96 + 8 + 8 + 2 + 1; // offset 155
    const winningOutcome = data[winningOutcomeOffset]; // 0=a, 1=b, 2=draw
    
    console.log('[checkMarketStatus] Parsed account data:', {
      isSettled,
      isVoided,
      isPaused,
      isSettlementFinalized,
      winningOutcome,
    });
    
    console.log('Account properly initialized - status:', isSettled ? 'settled' : 'initialized');
    return Response.json({
      status: isSettled ? 'settled' : 'initialized',
      settled: isSettled,
      voided: isVoided,
      paused: isPaused,
      settlement_finalized: isSettlementFinalized,
      winning_outcome: winningOutcome,
      marketPda: marketPda.toBase58(),
      size: actualSize,
      lamports: accountInfo.lamports,
      owner: accountInfo.owner.toBase58(),
    });
    
  } catch (error) {
    console.error('checkMarketStatus error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});