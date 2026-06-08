import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { PublicKey, Connection } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'node:buffer';

const SOLANA_PROGRAM_ID = Deno.env.get('SOLANA_PROGRAM_ID') || 'GtqYmsWv3EXdhnkahekABVnoqDhbmjrp7jQLqYxoepyR';

/**
 * Debug: Check on-chain market state before settlement
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { match_id } = await req.json();
    
    if (!match_id) {
      return Response.json({ error: 'match_id required' }, { status: 400 });
    }
    
    const bet = await base44.entities.Bet.filter({ match_id });
    if (!bet || bet.length === 0) {
      return Response.json({ error: 'Bet not found' }, { status: 404 });
    }
    
    const marketPda = bet[0].solana_market_pda;
    if (!marketPda) {
      return Response.json({ error: 'Market not deployed on-chain' }, { status: 404 });
    }
    
    const programId = new PublicKey(SOLANA_PROGRAM_ID);
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    
    // Fetch market account
    let marketInfo;
    try {
      marketInfo = await connection.getAccountInfo(new PublicKey(marketPda));
    } catch (connErr) {
      console.error('[debugMarketSettlement] Connection error:', connErr);
      return Response.json({
        error: 'Failed to connect to Solana',
        message: connErr.message,
        marketPda,
      }, { status: 500 });
    }
    
    if (!marketInfo) {
      return Response.json({ 
        error: 'Market account not found on-chain',
        marketPda,
        hint: 'Market may not be deployed yet - use "Deploy Market" first',
      }, { status: 404 });
    }
    
    console.log('[debugMarketSettlement] Market account found:', {
      owner: marketInfo.owner.toBase58(),
      dataSize: marketInfo.data.length,
      expectedSize: '>=246 bytes',
    });
    
    // Parse market data
    const data = marketInfo.data;
    console.log('[debugMarketSettlement] Market data (hex):', data.toString('hex'));
    
    if (data.length < 246) {
      return Response.json({
        marketPda,
        owner: marketInfo.owner.toBase58(),
        dataSize: marketInfo.data.length,
        error: 'Market account data too small - may be corrupted or from different program version',
        expectedSize: '>=246 bytes',
        dataHex: data.toString('hex'),
      });
    }
    
    // Parse market data with error handling
    let openUntil, settleAfter, feePercent, outcomeCount, winningOutcome, settled, voided;
    try {
      // Layout: disc(8) + match_id(32) + outcome_a(32) + outcome_b(32) + outcome_draw(32) + open_until(8) + settle_after(8) + fee_percent(2) + outcome_count(1) + winning_outcome(1) + ...
      // disc: 0-8
      // match_id: 8-40
      // outcome_a: 40-72
      // outcome_b: 72-104
      // outcome_draw: 104-136
      // open_until: 136-144
      // settle_after: 144-152
      // fee_percent: 152-154
      // outcome_count: 154
      // winning_outcome: 155
      // settled: 244
      // voided: 245
      openUntil = data.readBigUInt64LE(136);
      settleAfter = data.readBigUInt64LE(144);
      feePercent = data.readUInt16LE(152);
      outcomeCount = data[154];
      winningOutcome = data[155];
      settled = data[244];
      voided = data[245];
    } catch (parseErr) {
      console.error('[debugMarketSettlement] Failed to parse market data:', parseErr);
      return Response.json({
        marketPda,
        owner: marketInfo.owner.toBase58(),
        dataSize: marketInfo.data.length,
        error: 'Failed to parse market data - layout may have changed',
        parseError: parseErr.message,
        dataHex: data.toString('hex'),
      });
    }
    
    const now = Math.floor(Date.now() / 1000);
    
    // Safely convert timestamps to dates
    const safeDate = (ts) => {
      try {
        const num = Number(ts);
        if (isNaN(num) || num < 0 || num > 8640000000000000) return 'Invalid timestamp';
        return new Date(num * 1000).toISOString();
      } catch {
        return 'Failed to parse';
      }
    };
    
    return Response.json({
      marketPda,
      owner: marketInfo.owner.toBase58(),
      dataSize: marketInfo.data.length,
      openUntil: openUntil.toString(),
      openUntilDate: safeDate(openUntil),
      settleAfter: settleAfter.toString(),
      settleAfterDate: safeDate(settleAfter),
      feePercent: feePercent / 100,
      outcomeCount,
      winningOutcome,
      winningOutcomeLabel: winningOutcome === 0 ? 'Team A' : winningOutcome === 1 ? 'Team B' : winningOutcome === 2 ? 'Draw' : 'Not set',
      settled: settled === 1,
      voided: voided === 1,
      currentTime: now,
      canSettle: now > Number(settleAfter),
      timeUntilSettle: Number(settleAfter) - now,
    });
    
  } catch (error) {
    console.error('debugMarketSettlement error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});