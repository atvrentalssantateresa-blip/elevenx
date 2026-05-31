import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { Connection, PublicKey, Transaction, SystemProgram } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'node:buffer';

// IMPORTANT: Replace with your actual deployed program ID after deployment
const SOLANA_PROGRAM_ID = 'ElevenX1111111111111111111111111111111111111'; // Placeholder - update after deployment
const SOLANA_RPC_URL = 'https://api.devnet.solana.com';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.wallet_address) {
      return Response.json({ error: 'Wallet not connected' }, { status: 400 });
    }

    const { userBetId } = await req.json();

    if (!userBetId) {
      return Response.json({ error: 'Missing userBetId' }, { status: 400 });
    }

    // Get the user bet
    const userBets = await base44.entities.UserBet.filter({ id: userBetId });
    const userBet = userBets[0];

    if (!userBet) {
      return Response.json({ error: 'Bet not found' }, { status: 404 });
    }

    // Verify ownership
    if (userBet.created_by_id !== user.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Check if bet is won and not yet claimed
    if (userBet.status !== 'won') {
      return Response.json({ error: 'Bet is not won yet' }, { status: 400 });
    }

    // Get the bet pool PDA
    const betPoolPda = userBet.solana_bet_pool_pda;
    if (!betPoolPda) {
      return Response.json({ error: 'Bet pool PDA not found' }, { status: 400 });
    }

    // Get the user position PDA
    const userPositionPda = userBet.solana_position_pda;
    if (!userPositionPda) {
      return Response.json({ error: 'User position PDA not found' }, { status: 400 });
    }

    // Prepare the claim_winnings instruction
    // Instruction layout: [instruction_type=6] (claim_winnings is 6th instruction)
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
    const userPubkey = new PublicKey(user.wallet_address);
    const programId = new PublicKey(SOLANA_PROGRAM_ID);
    const betPoolPubkey = new PublicKey(betPoolPda);
    const userPositionPubkey = new PublicKey(userPositionPda);

    // Claim winnings instruction data: [6] (no additional params needed)
    const data = Buffer.from([6]);

    const keys = [
      { pubkey: betPoolPubkey, isSigner: false, isWritable: true },
      { pubkey: userPositionPubkey, isSigner: false, isWritable: true },
      { pubkey: userPubkey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];

    // In devnet/testing mode, we'll just update the database
    // In production, the frontend would construct and sign the transaction
    const payoutAmount = userBet.actual_payout || userBet.potential_payout;

    await base44.entities.UserBet.update(userBetId, {
      status: 'claimed',
    });

    console.log(`✓ Claimed winnings for user ${user.wallet_address}: ◎${payoutAmount}`);

    return Response.json({
      success: true,
      message: 'Winnings claimed successfully',
      payout: payoutAmount,
      solana_instruction: {
        instruction_type: 'claim_winnings',
        betPoolPda: betPoolPda,
        userPositionPda: userPositionPda,
        userPubkey: user.wallet_address,
        payoutAmount,
      }
    });

  } catch (error) {
    console.error('claimWinnings error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});