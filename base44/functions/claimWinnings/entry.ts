import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { PublicKey } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'node:buffer';

const SOLANA_PROGRAM_ID = Deno.env.get('SOLANA__PROGRAM_ID') || 'PMut1111111111111111111111111111111111111111';

/**
 * Pari-mutuel claim — winner claims proportional share of the pool.
 * Payout = stake × total_pool × (1 - fee%) / winner_pool
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { userBetId } = await req.json();
    if (!userBetId) return Response.json({ error: 'Missing userBetId' }, { status: 400 });

    const userBets = await base44.entities.UserBet.filter({ id: userBetId });
    const userBet = userBets[0];
    if (!userBet) return Response.json({ error: 'Bet not found' }, { status: 404 });
    if (userBet.created_by_id !== user.id) return Response.json({ error: 'Unauthorized' }, { status: 403 });
    if (userBet.status !== 'won') return Response.json({ error: 'Bet is not won' }, { status: 400 });

    const bets = await base44.entities.Bet.filter({ id: userBet.bet_id });
    const bet  = bets[0];
    if (!bet) return Response.json({ error: 'Bet not found' }, { status: 400 });

    const walletAddress = user.wallet_address;
    if (!walletAddress) return Response.json({ error: 'Wallet not connected' }, { status: 400 });

    const bettorPubkey = new PublicKey(walletAddress);
    const programId    = new PublicKey(SOLANA_PROGRAM_ID);
    const matchIdBytes = Buffer.alloc(32);
    Buffer.from(userBet.match_id, 'utf-8').copy(matchIdBytes, 0, 0, Math.min(userBet.match_id.length, 32));

    // Use new pari-mutuel PDA seeds
    const [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('pm_market'), matchIdBytes],
      programId
    );
    
    const outcomeIndex = userBet.outcome === 'a' ? 0 : userBet.outcome === 'draw' ? 1 : 2;
    
    const [positionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('pm_position'), marketPda.toBuffer(), bettorPubkey.toBuffer(), Buffer.from([outcomeIndex])],
      programId
    );
    
    const [feeVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('pm_fee_vault')],
      programId
    );

    console.log(`✓ Claim: user=${user.id} | bet=${userBet.amount} SOL on ${userBet.outcome_label}`);

    return Response.json({
      success: true,
      message: `Sign to claim pari-mutuel winnings`,
      solana_instruction: {
        instruction_type: 'claim_winnings',
        programId: SOLANA_PROGRAM_ID,
        marketPda:    marketPda.toBase58(),
        positionPda:  positionPda.toBase58(),
        feeVaultPda:  feeVaultPda.toBase58(),
        bettorPubkey: walletAddress,
      },
    });

  } catch (error) {
    console.error('claimWinnings error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});