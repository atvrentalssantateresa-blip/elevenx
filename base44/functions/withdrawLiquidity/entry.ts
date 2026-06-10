import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { PublicKey, Connection } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'node:buffer';

/**
 * withdraw_liquidity instruction builder (LP withdraws unmatched liquidity)
 * Discriminator: [10, 224, 253, 15, 227, 173, 172, 25]
 * Data: discriminator (no additional data)
 * Accounts: market, lp_offer, lp, system_program
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const SOLANA_PROGRAM_ID = Deno.env.get('SOLANA_PROGRAM_ID');
    
    if (!SOLANA_PROGRAM_ID) {
      return Response.json({ error: 'Solana program ID not configured' }, { status: 500 });
    }
    
    const { walletAddress, userBetId } = await req.json();

    if (!walletAddress) return Response.json({ error: 'Wallet not connected' }, { status: 401 });
    if (!userBetId) return Response.json({ error: 'Missing userBetId' }, { status: 400 });

    // Fetch UserBet
    const userBets = await base44.entities.UserBet.filter({ id: userBetId });
    const userBet = userBets[0];
    if (!userBet) return Response.json({ error: 'UserBet not found' }, { status: 404 });
    if (userBet.role !== 'lp') return Response.json({ error: 'Not an LP bet' }, { status: 400 });

    // Fetch BetOffer
    let offer = null;
    let withdrawAmount = 0;
    
    if (userBet.offer_id) {
      const offers = await base44.entities.BetOffer.filter({ id: userBet.offer_id });
      offer = offers[0];
      if (!offer) return Response.json({ error: 'Offer not found' }, { status: 404 });
      withdrawAmount = offer.amount_unmatched || 0;
    } else {
      withdrawAmount = userBet.liquidity_unmatched || 0;
    }
    
    if (withdrawAmount <= 0) {
      return Response.json({ error: 'No unmatched liquidity remaining' }, { status: 400 });
    }

    // Fetch Bet
    const bets = await base44.entities.Bet.filter({ id: userBet.bet_id });
    const bet = bets[0];
    if (!bet) return Response.json({ error: 'Bet not found' }, { status: 400 });

    // Derive PDAs
    const programId = new PublicKey(SOLANA_PROGRAM_ID);
    const lpPubkey = new PublicKey(walletAddress);
    const matchIdBytes = Buffer.alloc(32);
    Buffer.from(userBet.match_id, 'utf-8').copy(matchIdBytes, 0, 0, Math.min(userBet.match_id.length, 32));
    
    const [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('market'), matchIdBytes],
      programId
    );
    
    const outcomeIndex = userBet.outcome === 'a' ? 0 : userBet.outcome === 'b' ? 1 : 2;
    
    const [lpOfferPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('lp_offer'), marketPda.toBuffer(), lpPubkey.toBuffer(), Buffer.from([outcomeIndex])],
      programId
    );

    // Check on-chain balance
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const lpOfferPubkey = offer?.solana_position_pda ? new PublicKey(offer.solana_position_pda) : lpOfferPda;
    const accountInfo = await connection.getAccountInfo(lpOfferPubkey);
    const onChainBalance = (accountInfo?.lamports || 0) / 1e9;
    
    if (onChainBalance < 0.001) {
      return Response.json({ error: 'No funds available on-chain' }, { status: 400 });
    }

    // Build instruction data: discriminator only (no args)
    const discriminator = Buffer.from([10, 224, 253, 15, 227, 173, 172, 25]);
    const instructionData = discriminator;

    console.log('[withdrawLiquidity] Discriminator (bytes):', Array.from(discriminator));
    console.log('[withdrawLiquidity] Discriminator (hex):', discriminator.toString('hex'));

    // Build accounts in exact order:
    // 1. market [writable]
    // 2. lp_offer [writable]
    // 3. lp [signer, writable]
    // 4. system_program [readonly]
    const keys = [
      { pubkey: marketPda.toBase58(), isSigner: false, isWritable: true },
      { pubkey: lpOfferPda.toBase58(), isSigner: false, isWritable: true },
      { pubkey: walletAddress, isSigner: true, isWritable: true },
      { pubkey: '11111111111111111111111111111111', isSigner: false, isWritable: false },
    ];

    console.log('[withdrawLiquidity] Accounts:');
    keys.forEach((k, i) => {
      console.log(`  [${i}] ${k.pubkey} (isSigner: ${k.isSigner}, isWritable: ${k.isWritable})`);
    });

    return Response.json({
      success: true,
      userBetId,
      offerId: offer?.id,
      amount: onChainBalance,
      solana_instruction: {
        instruction_type: 'withdraw_liquidity',
        programId: SOLANA_PROGRAM_ID,
        keys,
        instruction_data: instructionData.toString('base64'),
      },
      message: `Sign to withdraw ◎${onChainBalance.toFixed(4)}`,
    });

  } catch (error) {
    console.error('[withdrawLiquidity] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});