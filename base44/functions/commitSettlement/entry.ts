import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { Connection } from 'npm:@solana/web3.js@1.98.4';

/**
 * Commit settlement results to database AFTER admin transaction succeeds on-chain.
 * Updates Bet status and UserBet statuses to 'won'/'lost' so players can claim.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const serviceRole = base44.asServiceRole;
    
    const payload = await req.json();
    const { signature, commit_data } = payload;
    
    if (!signature || !commit_data) {
      return Response.json({ error: 'Missing signature or commit_data' }, { status: 400 });
    }
    
    // Skip on-chain verification for admin DB overrides
    if (!signature.startsWith('db-override-')) {
      let rpcUrl = Deno.env.get('SOLANA_RPC_URL') || '';
      if (rpcUrl.includes('RPC_URL=')) rpcUrl = rpcUrl.split('RPC_URL=')[1].trim();
      if (!rpcUrl.startsWith('http')) rpcUrl = 'https://api.mainnet-beta.solana.com';
      const connection = new Connection(rpcUrl, 'confirmed');
      const confirmation = await connection.getSignatureStatus(signature);
      
      if (!confirmation || !confirmation.value || confirmation.value.err) {
        console.error('[commitSettlement] Transaction failed on-chain:', confirmation);
        return Response.json({ 
          error: 'Transaction not confirmed on-chain',
          debug: confirmation,
        }, { status: 400 });
      }
      console.log('[commitSettlement] ✓ Transaction verified on-chain:', signature);
    } else {
      console.log('[commitSettlement] DB override — skipping on-chain verification');
    }
    
    const { bet_id, match_id, winning_outcome, outcome_label, all_bet_ids } = commit_data;
    
    // Update Bet status
    await serviceRole.entities.Bet.update(bet_id, {
      status: 'settled',
      winning_outcome: winning_outcome,
    });
    console.log('[commitSettlement] Updated Bet status to settled');
    
    // Update all UserBets for this match
    const allUserBets = await serviceRole.entities.UserBet.filter({ match_id });
    console.log('[commitSettlement] Found', allUserBets.length, 'UserBets to update');
    
    let wonCount = 0;
    let lostCount = 0;
    
    for (const userBet of allUserBets) {
      if (userBet.status !== 'active') {
        continue; // Skip already processed bets
      }
      
      const isLp = userBet.role === 'lp';
      const backedWinner = userBet.outcome === winning_outcome;
      let isWinner = false;
      let payout = 0;
      
      // CRITICAL: LP wins when their backed outcome LOSES (collects losing bettors' stakes)
      // LP loses when their backed outcome WINS (no losing bettors to collect from)
      // SPECIAL CASE: Draw outcome - ALL LPs on A/B lose, funds go to DAO
      if (isLp) {
        // SPECIAL DRAW LOGIC: If winning outcome is Draw, all LPs on A/B lose
        if (winning_outcome === 'draw') {
          isWinner = false;
          payout = 0;
          console.log('[commitSettlement] LP LOST (Draw outcome - funds to DAO):', {
            userBetId: userBet.id,
            role: userBet.role,
            backed_outcome: userBet.outcome,
            winning_outcome,
            reason: 'Draw outcome - all LP positions lose, funds swept to DAO'
          });
        } else if (!backedWinner) {
          // LP wins when backed outcome LOSES (collects losing bettor stakes)
          isWinner = true;
          // LP earns matched liquidity (losing bettor stakes) + fees
          payout = userBet.liquidity_matched || userBet.amount || 0;
          console.log('[commitSettlement] LP WON (backed loser):', {
            userBetId: userBet.id,
            role: userBet.role,
            backed_outcome: userBet.outcome,
            winning_outcome,
            reason: 'LP backed the losing outcome, collects from winning bettors'
          });
        } else {
          // LP loses when backed outcome WINS (no losing bettors to collect from)
          isWinner = false;
          payout = 0;
          console.log('[commitSettlement] LP LOST (backed winner):', {
            userBetId: userBet.id,
            role: userBet.role,
            backed_outcome: userBet.outcome,
            winning_outcome,
            reason: 'LP backed the winning outcome, no losing bettors to collect from'
          });
        }
      } else {
        // Regular bettor wins when backed outcome WINS
        if (backedWinner) {
          isWinner = true;
          payout = userBet.potential_payout || 0;
          console.log('[commitSettlement] Bettor WON:', {
            userBetId: userBet.id,
            role: userBet.role,
            backed_outcome: userBet.outcome,
            winning_outcome
          });
        } else {
          console.log('[commitSettlement] Bettor LOST:', {
            userBetId: userBet.id,
            role: userBet.role,
            backed_outcome: userBet.outcome,
            winning_outcome
          });
        }
      }
      
      await serviceRole.entities.UserBet.update(userBet.id, {
        status: isWinner ? 'won' : 'lost',
        actual_payout: payout,
      });
      
      if (isWinner) {
        wonCount++;
      } else {
        lostCount++;
      }
    }
    
    console.log('[commitSettlement] Updated UserBets:', { won: wonCount, lost: lostCount });
    
    // Update Match status if needed
    const match = await serviceRole.entities.Match.get(match_id);
    if (match && match.status !== 'finished') {
      await serviceRole.entities.Match.update(match_id, {
        status: 'finished',
        winner: winning_outcome === 'a' ? 'team_a' : winning_outcome === 'b' ? 'team_b' : 'draw',
      });
    }
    
    return Response.json({
      success: true,
      message: `✓ Market settled! ${wonCount} winners can now claim winnings`,
      wonCount,
      lostCount,
    });
    
  } catch (error) {
    console.error('[commitSettlement] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});