import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { PublicKey, Connection } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'node:buffer';

/**
 * Debug function to check LP offer account state right before withdrawal.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
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

    // Fetch BetOffer
    const offers = await base44.entities.BetOffer.filter({ id: userBet.offer_id });
    const offer = offers[0];
    if (!offer) {
      return Response.json({ error: 'BetOffer not found' }, { status: 404 });
    }

    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const programId = new PublicKey(SOLANA_PROGRAM_ID);
    const lpOfferPda = new PublicKey(offer.solana_position_pda);

    // Fetch LP offer account
    const lpOfferAccountInfo = await connection.getAccountInfo(lpOfferPda);
    if (!lpOfferAccountInfo) {
      return Response.json({ 
        error: 'LP offer account not found on-chain',
        lpOfferPda: lpOfferPda.toBase58()
      });
    }

    // Parse LpOffer layout: discriminator (8) + market (32) + lp (32) + outcome (1) + odds_bps (8) + amount_committed (8) + amount_matched (8) + closed (1) + matched_stake (8) + withdrawn (1) + bump (1) = 108 bytes
    const accountData = lpOfferAccountInfo.data;
    const storedOutcome = accountData[72];
    const withdrawnFlag = accountData[106];
    const amountMatched = Number(accountData.readBigUInt64LE(89));
    const amountCommitted = Number(accountData.readBigUInt64LE(81));
    const closed = accountData[97] === 1;
    const matchedStake = Number(accountData.readBigUInt64LE(98));
    
    // Read LP wallet address (bytes 40-71)
    const lpWalletBytes = accountData.slice(40, 72);
    const lpWalletOnChain = new PublicKey(lpWalletBytes).toBase58();

    // Fetch market to check winning_outcome
    const matchIdBytes = Buffer.alloc(32);
    Buffer.from(userBet.match_id, 'utf-8').copy(matchIdBytes, 0, 0, Math.min(userBet.match_id.length, 32));
    const [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('market'), matchIdBytes],
      programId
    );

    const marketAccountInfo = await connection.getAccountInfo(marketPda);
    if (!marketAccountInfo) {
      return Response.json({ error: 'Market account not found on-chain' });
    }

    const marketData = marketAccountInfo.data;
    const onChainWinningOutcome = marketData[155];
    const settled = marketData[244] === 1;

    return Response.json({
      success: true,
      lpOffer: {
        pda: lpOfferPda.toBase58(),
        outcome: storedOutcome,
        withdrawn: withdrawnFlag === 1,
        amountMatched: amountMatched / 1e9,
        amountMatchedLamports: amountMatched,
        amountCommitted: amountCommitted / 1e9,
        closed,
        matchedStake: matchedStake / 1e9,
        accountDataLength: accountData.length,
        lpWalletOnChain,
      },
      market: {
        pda: marketPda.toBase58(),
        winningOutcome: onChainWinningOutcome,
        settled,
      },
      checks: {
        lpWinsCondition: storedOutcome !== onChainWinningOutcome,
        hasMatched: amountMatched > 0,
        notWithdrawn: withdrawnFlag !== 1,
        marketSettled: settled,
        walletMatches: lpWalletOnChain === userBet.wallet_address,
      },
      walletUsed: userBet.wallet_address
    });

  } catch (error) {
    console.error('debugLpWithdraw error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});