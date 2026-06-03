import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { Connection, PublicKey, SystemProgram, Transaction } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'node:buffer';

const SOLANA_PROGRAM_ID = Deno.env.get('SOLANA_PROGRAM_ID') || '4epUYJPwoPhG9RPoQ6qT9dsAewJCDBSCGUpR1Xj9UxTm';
const SOLANA_RPC_URL = 'https://api.devnet.solana.com';

/**
 * Emergency payout - admin-only function to directly transfer winnings to users
 * when position accounts are missing. This bypasses the normal claim flow.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    const payload = await req.json();
    const { bet_id } = payload;

    if (!bet_id) {
      return Response.json({ error: 'Missing bet_id' }, { status: 400 });
    }

    // Get the bet
    const bets = await base44.entities.Bet.filter({ id: bet_id });
    const bet = bets[0];
    if (!bet) {
      return Response.json({ error: 'Bet not found' }, { status: 404 });
    }

    // Get all winning user bets for this bet
    const allUserBets = await base44.entities.UserBet.filter({ bet_id });
    const winningBets = allUserBets.filter(ub => ub.status === 'won' || ub.status === 'active');
    
    if (winningBets.length === 0) {
      return Response.json({ error: 'No winning bets found' }, { status: 404 });
    }

    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
    const programId = new PublicKey(SOLANA_PROGRAM_ID);
    
    // Derive market PDA
    const matchIdBytes = Buffer.alloc(32);
    Buffer.from(bet.match_id, 'utf-8').copy(matchIdBytes, 0, 0, Math.min(bet.match_id.length, 32));
    
    const [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('market'), matchIdBytes],
      programId
    );

    // Check market account exists
    const marketAccountInfo = await connection.getAccountInfo(marketPda);
    if (!marketAccountInfo) {
      return Response.json({ 
        error: 'Market does not exist on-chain',
        marketPda: marketPda.toBase58(),
        message: 'Create the market on-chain first before distributing winnings'
      });
    }

    // Calculate total payout needed
    const totalPayout = winningBets.reduce((sum, ub) => {
      return sum + (ub.actual_payout || ub.potential_payout || ub.amount || 0);
    }, 0);

    // Get admin wallet for signing
    const adminWallet = user.wallet_address;
    if (!adminWallet) {
      return Response.json({ error: 'Admin wallet not connected' }, { status: 400 });
    }

    // For emergency payout, we need to:
    // 1. Transfer SOL from market PDA to each user
    // 2. This requires a special instruction that uses invoke_signed
    
    // Since we can't sign with PDA from client-side, we'll create instructions
    // that the admin can sign to authorize the payout
    
    const payoutInstructions = [];
    
    for (const userBet of winningBets) {
      const payout = userBet.actual_payout || userBet.potential_payout || userBet.amount || 0;
      if (payout <= 0) continue;
      
      const userPubkey = new PublicKey(userBet.wallet_address);
      const lamports = Math.floor(payout * 1e9);
      
      payoutInstructions.push({
        userBetId: userBet.id,
        wallet: userPubkey.toBase58(),
        amount: payout,
        lamports,
      });
    }

    // Return instructions for admin to sign
    // Note: This is a simplified approach - in production you'd want proper PDA signing
    return Response.json({
      success: true,
      message: `Emergency payout ready for ${winningBets.length} bet(s)`,
      bet_id,
      marketPda: marketPda.toBase58(),
      totalPayout,
      payoutInstructions,
      warning: 'This requires admin to manually transfer SOL from market PDA to users',
      next_steps: [
        '1. Verify market PDA has sufficient SOL balance',
        '2. Use Solana CLI or wallet to transfer from market PDA to each user',
        '3. Update UserBet status to "claimed" manually in database'
      ]
    });

  } catch (error) {
    console.error('emergencyPayout error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});