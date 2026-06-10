import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { Connection, PublicKey } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'node:buffer';

function getSolanaConfig() {
  const rpcUrl = Deno.env.get('SOLANA_RPC_URL');
  const programIdStr = Deno.env.get('ELEVENX_PROGRAM_ID');
  if (!rpcUrl) throw new Error('SOLANA_RPC_URL secret not set');
  if (!programIdStr) throw new Error('ELEVENX_PROGRAM_ID secret not set');
  return { rpcUrl, programIdStr, programId: new PublicKey(programIdStr), connection: new Connection(rpcUrl, 'confirmed') };
}

/**
 * withdraw_lp_winnings instruction builder
 * Discriminator: [11, 254, 180, 24, 82, 12, 16, 113]
 * Data: discriminator + amount (u64 LE)
 * Accounts: market, lp_offer, fee_vault, lp_wallet, system_program
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const serviceRole = base44.asServiceRole;
    const { programIdStr, programId } = getSolanaConfig();

    const { userBetId } = await req.json();
    if (!userBetId) return Response.json({ error: 'Missing userBetId' }, { status: 400 });

    const userBets = await serviceRole.entities.UserBet.filter({ id: userBetId });
    const userBet = userBets[0];
    if (!userBet || userBet.role !== 'lp') {
      return Response.json({ error: 'Only LP positions can withdraw winnings' }, { status: 400 });
    }
    if (!userBet.offer_id) return Response.json({ error: 'LP offer not found' }, { status: 400 });

    const offers = await serviceRole.entities.BetOffer.filter({ id: userBet.offer_id });
    const offer = offers[0];
    if (!offer) return Response.json({ error: 'BetOffer not found' }, { status: 404 });

    const bets = await serviceRole.entities.Bet.filter({ id: userBet.bet_id });
    const bet = bets[0];
    if (!bet || bet.status !== 'settled') {
      return Response.json({ error: 'Market not settled' }, { status: 400 });
    }

    const lpPubkey = new PublicKey(offer.lp_wallet_address || userBet.wallet_address);
    const matchIdBytes = Buffer.alloc(32);
    Buffer.from(userBet.match_id, 'utf-8').copy(matchIdBytes, 0, 0, Math.min(userBet.match_id.length, 32));

    const [marketPda] = PublicKey.findProgramAddressSync([Buffer.from('market'), matchIdBytes], programId);
    const outcomeIndex = userBet.outcome === 'a' ? 0 : userBet.outcome === 'b' ? 1 : 2;
    const [lpOfferPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('lp_offer'), marketPda.toBuffer(), lpPubkey.toBuffer(), Buffer.from([outcomeIndex])], programId
    );
    const [feeVaultPda] = PublicKey.findProgramAddressSync([Buffer.from('fee_vault')], programId);

    const withdrawAmountSol = offer.amount_matched || 0;
    const withdrawAmountLamports = Math.round(withdrawAmountSol * 1_000_000_000);

    const discriminator = Buffer.from([11, 254, 180, 24, 82, 12, 16, 113]);
    const instructionData = Buffer.alloc(16);
    discriminator.copy(instructionData, 0);
    instructionData.writeBigUInt64LE(BigInt(withdrawAmountLamports), 8);

    console.log('[withdrawLpWinnings] programId:', programIdStr);
    console.log('[withdrawLpWinnings] Discriminator (hex):', discriminator.toString('hex'));
    console.log('[withdrawLpWinnings] Amount (lamports):', withdrawAmountLamports);

    // Accounts: market, lp_offer, fee_vault, lp_wallet [NOT signer], system_program
    const keys = [
      { pubkey: marketPda.toBase58(), isSigner: false, isWritable: true },
      { pubkey: lpOfferPda.toBase58(), isSigner: false, isWritable: true },
      { pubkey: feeVaultPda.toBase58(), isSigner: false, isWritable: true },
      { pubkey: lpPubkey.toBase58(), isSigner: false, isWritable: true },
      { pubkey: '11111111111111111111111111111111', isSigner: false, isWritable: false },
    ];
    console.log('[withdrawLpWinnings] Accounts:', keys.map((k, i) => `[${i}] ${k.pubkey}`));

    return Response.json({
      success: true, withdrawAmount: withdrawAmountSol, withdrawAmountLamports, userBetId, offerId: offer.id,
      solana_instruction: {
        instruction_type: 'withdraw_lp_winnings',
        programId: programIdStr,
        keys,
        instruction_data: instructionData.toString('base64'),
      },
      message: `Sign to withdraw ◎${withdrawAmountSol.toFixed(4)} from settled market`,
    });
  } catch (error) {
    console.error('[withdrawLpWinnings] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});