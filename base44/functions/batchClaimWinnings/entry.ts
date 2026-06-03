import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { PublicKey } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'node:buffer';

const SOLANA_PROGRAM_ID = Deno.env.get('SOLANA__PROGRAM_ID') || 'PMut1111111111111111111111111111111111111111';

/**
 * Batch claim winnings for all won bets on a specific match.
 * Groups all winning positions for a single match into one claim transaction.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { matchId } = await req.json();
    if (!matchId) return Response.json({ error: 'Missing matchId' }, { status: 400 });

    // Get all user's won bets for this match
    const allUserBets = await base44.entities.UserBet.filter({ match_id: matchId });
    const wonBets = allUserBets.filter(
      ub => ub.created_by_id === user.id && ub.status === 'won'
    );

    if (wonBets.length === 0) {
      return Response.json({ error: 'No won bets found for this match' }, { status: 400 });
    }

    const walletAddress = user.wallet_address;
    if (!walletAddress) {
      return Response.json({ error: 'Wallet not connected' }, { status: 400 });
    }

    // Calculate total payout
    const totalPayout = wonBets.reduce((sum, bet) => sum + (bet.actual_payout || bet.potential_payout || 0), 0);

    const bettorPubkey = new PublicKey(walletAddress);
    const programId = new PublicKey(SOLANA_PROGRAM_ID);
    const matchIdBytes = Buffer.alloc(32);
    Buffer.from(matchId, 'utf-8').copy(matchIdBytes, 0, 0, Math.min(matchId.length, 32));

    // Get market PDA (same for all bets on this match)
    const [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('pm_market'), matchIdBytes],
      programId
    );

    const [feeVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('pm_fee_vault')],
      programId
    );

    // Collect all position PDAs for the won bets
    const positionPdas = wonBets.map(bet => {
      const outcomeIndex = bet.outcome === 'a' ? 0 : bet.outcome === 'draw' ? 1 : 2;
      const [positionPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('pm_position'), marketPda.toBuffer(), bettorPubkey.toBuffer(), Buffer.from([outcomeIndex])],
        programId
      );
      return positionPda.toBase58();
    });

    console.log(`✓ Batch Claim: user=${user.id} | match=${matchId} | bets=${wonBets.length} | total=${totalPayout} SOL`);

    return Response.json({
      success: true,
      message: `Sign to claim ${wonBets.length} winning bet(s) from this match`,
      totalPayout,
      betCount: wonBets.length,
      betIds: wonBets.map(b => b.id),
      solana_instruction: {
        instruction_type: 'claim_winnings',
        programId: SOLANA_PROGRAM_ID,
        marketPda: marketPda.toBase58(),
        positionPda: positionPdas[0], // Use first position PDA (program handles all positions for this user/market)
        feeVaultPda: feeVaultPda.toBase58(),
        bettorPubkey: walletAddress,
      },
    });

  } catch (error) {
    console.error('batchClaimWinnings error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});