import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { PublicKey, Connection } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'node:buffer';

/**
 * Check on-chain state of an LP offer before allowing withdrawal.
 * Returns the actual on-chain state to prevent "Nothing to claim" errors.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const serviceRole = base44.asServiceRole;
    
    const SOLANA_PROGRAM_ID = Deno.env.get('SOLANA_PROGRAM_ID');
    if (!SOLANA_PROGRAM_ID) {
      return Response.json({ error: 'Solana program ID not configured' }, { status: 500 });
    }
    
    const { userBetId } = await req.json();
    if (!userBetId) {
      return Response.json({ error: 'Missing userBetId' }, { status: 400 });
    }

    // Fetch UserBet
    const userBets = await base44.entities.UserBet.filter({ id: userBetId });
    const userBet = userBets[0];
    if (!userBet) {
      return Response.json({ error: 'UserBet not found' }, { status: 404 });
    }

    // Must be LP role
    if (userBet.role !== 'lp') {
      return Response.json({ error: 'Only LP positions can withdraw' }, { status: 400 });
    }

    // Fetch BetOffer to get the PDA
    if (!userBet.offer_id) {
      return Response.json({ error: 'LP offer not found' }, { status: 400 });
    }
    
    const offers = await base44.entities.BetOffer.filter({ id: userBet.offer_id });
    const offer = offers[0];
    if (!offer) {
      return Response.json({ error: 'BetOffer not found' }, { status: 404 });
    }

    // Fetch Bet to check settlement
    const bets = await base44.entities.Bet.filter({ id: userBet.bet_id });
    const bet = bets[0];
    if (!bet) {
      return Response.json({ error: 'Bet not found' }, { status: 404 });
    }

    // Check on-chain state
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    
    try {
      const lpOfferPda = new PublicKey(offer.solana_position_pda);
      const lpOfferAccountInfo = await connection.getAccountInfo(lpOfferPda);
      
      if (!lpOfferAccountInfo) {
        return Response.json({ 
          error: 'LP position not found on-chain',
          canClaim: false,
          reason: 'not_found_on_chain'
        }, { status: 200 });
      }

      // Parse the LP offer account data
      // LpOffer layout: discriminator (8) + lp (32) + outcome (1) + amount_matched (8) + withdrawn (1) + bump (1) = 51 bytes
      const accountData = lpOfferAccountInfo.data;
      const withdrawnFlag = accountData[41]; // withdrawn is a bool at offset 41
      const amountMatchedOnChain = accountData.readBigUInt64LE(9); // amount_matched at offset 9

      console.log('[checkLpOfferOnChain] On-chain state:', {
        withdrawn: withdrawnFlag === 1,
        amountMatchedOnChain: Number(amountMatchedOnChain) / 1e9,
      });

      if (withdrawnFlag === 1) {
        return Response.json({ 
          error: 'LP position already withdrawn on-chain',
          canClaim: false,
          reason: 'already_withdrawn',
          onChainState: {
            withdrawn: true,
            amountMatched: Number(amountMatchedOnChain) / 1e9,
          }
        }, { status: 200 });
      }

      if (Number(amountMatchedOnChain) <= 0) {
        return Response.json({ 
          error: 'No matched liquidity on-chain',
          canClaim: false,
          reason: 'no_liquidity',
          onChainState: {
            withdrawn: false,
            amountMatched: Number(amountMatchedOnChain) / 1e9,
          }
        }, { status: 200 });
      }

      // Position is claimable
      return Response.json({
        canClaim: true,
        onChainState: {
          withdrawn: false,
          amountMatched: Number(amountMatchedOnChain) / 1e9,
        },
        message: 'LP position is claimable'
      });

    } catch (onChainErr) {
      console.error('[checkLpOfferOnChain] Failed to fetch on-chain state:', onChainErr.message);
      return Response.json({ 
        error: 'Failed to fetch on-chain state: ' + onChainErr.message,
        canClaim: false,
        reason: 'fetch_error'
      }, { status: 200 });
    }

  } catch (error) {
    console.error('checkLpOfferOnChain error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});