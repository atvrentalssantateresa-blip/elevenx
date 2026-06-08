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
    const marketInfo = await connection.getAccountInfo(new PublicKey(marketPda));
    if (!marketInfo) {
      return Response.json({ 
        error: 'Market account not found on-chain',
        marketPda,
      }, { status: 404 });
    }
    
    console.log('[debugMarketSettlement] Market account found:', {
      owner: marketInfo.owner.toBase58(),
      dataSize: marketInfo.data.length,
    });
    
    // Parse market data
    const data = marketInfo.data;
    console.log('[debugMarketSettlement] Market data (hex):', data.toString('hex'));
    
    // Layout: disc(8) + match_id(32) + outcome_names(96) + open_until(8) + settle_after(8) + fee_percent(2) + outcome_count(1) + winning_outcome(1) + oracle_odds(24) + total_matched(24) + total_pending(24) + total_lp_committed(8) + accrued_fees(8) + settled(1) + voided(1) + ...
    const openUntil = data.readBigUInt64LE(146);
    const settleAfter = data.readBigUInt64LE(154);
    const feePercent = data.readUInt16LE(152);
    const outcomeCount = data[154];
    const winningOutcome = data[155];
    const settled = data[244];
    const voided = data[245];
    
    const now = Math.floor(Date.now() / 1000);
    
    return Response.json({
      marketPda,
      owner: marketInfo.owner.toBase58(),
      dataSize: marketInfo.data.length,
      openUntil: openUntil.toString(),
      openUntilDate: new Date(Number(openUntil) * 1000).toISOString(),
      settleAfter: settleAfter.toString(),
      settleAfterDate: new Date(Number(settleAfter) * 1000).toISOString(),
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