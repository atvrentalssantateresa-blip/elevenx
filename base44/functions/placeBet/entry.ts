import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { PublicKey } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'node:buffer';

/**
 * Pari-mutuel betting — no LP required.
 * Bettor places SOL into the market pool, odds update dynamically.
 * Returns the Solana instruction for the frontend to sign.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const SOLANA_PROGRAM_ID = Deno.env.get('SOLANA__PROGRAM_ID');
    if (!SOLANA_PROGRAM_ID) {
      return Response.json({ error: 'Solana program ID not configured. Please contact support.' }, { status: 500 });
    }
    
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    if (!base58Regex.test(SOLANA_PROGRAM_ID)) {
      return Response.json({ error: 'Invalid Solana program ID configuration. Please contact support.' }, { status: 500 });
    }
    
    const payload = await req.json();
    const { walletAddress, bet_id, match_id, outcome, amount } = payload;

    if (!walletAddress) return Response.json({ error: 'Wallet not connected' }, { status: 401 });
    if (!bet_id || !match_id || outcome === undefined || !amount) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (amount <= 0) return Response.json({ error: 'Amount must be positive' }, { status: 400 });

    if (!base58Regex.test(walletAddress)) {
      return Response.json({ 
        error: 'Invalid wallet address format. Please reconnect your wallet.', 
        hint: 'Address contains invalid characters or is corrupted'
      }, { status: 400 });
    }

    const bets = await base44.entities.Bet.filter({ id: bet_id });
    const bet = bets[0];
    if (!bet || bet.status !== 'open') return Response.json({ error: 'Bet not open' }, { status: 400 });

    const outcomeIndex = outcome === 'a' ? 0 : outcome === 'draw' ? 1 : 2;
    const outcomeLabel = outcome === 'a' ? bet.outcome_a : outcome === 'b' ? bet.outcome_b : 'Draw';

    const match = await base44.entities.Match.list().then(ms => ms.find(m => m.id === match_id));

    // Derive PDAs (using new pari-mutuel seeds: "pm_market", "pm_position")
    const bettorPubkey = new PublicKey(walletAddress);
    const programId = new PublicKey(SOLANA_PROGRAM_ID);
    const matchIdBytes = Buffer.alloc(32);
    Buffer.from(match_id, 'utf-8').copy(matchIdBytes, 0, 0, Math.min(match_id.length, 32));

    const [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('market'), matchIdBytes],
      programId
    );
    
    const [positionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('position'), marketPda.toBuffer(), bettorPubkey.toBuffer()],
      programId
    );
    
    // Derive LP offer PDA - use a system/placeholder LP address for pari-mutuel mode
    // This allows betting even without a real LP by using a "pool" as the LP
    const systemLpPubkey = new PublicKey('11111111111111111111111111111111'); // System program as placeholder LP
    const [lpOfferPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('lp_offer'), marketPda.toBuffer(), systemLpPubkey.toBuffer(), Buffer.from([outcomeIndex])],
      programId
    );

    // Update bet pool totals
    const poolField = outcome === 'a' ? 'backed_amount_a' : outcome === 'b' ? 'backed_amount_b' : 'backed_amount_draw';
    await base44.entities.Bet.update(bet_id, {
      [poolField]: (bet[poolField] || 0) + amount,
      total_pool: (bet.total_pool || 0) + amount,
      total_bettors: (bet.total_bettors || 0) + 1,
    });

    // Create UserBet record
    const userBet = await base44.entities.UserBet.create({
      bet_id,
      match_id,
      offer_id: null, // No LP offers in pari-mutuel
      outcome,
      amount,
      role: 'matcher',
      status: 'active', // Immediately active (no pending state)
      outcome_label: outcomeLabel,
      match_title: `${match?.team_a} vs ${match?.team_b}`,
      potential_payout: 0, // Will be calculated at claim time
      wallet_address: walletAddress,
    });

    return Response.json({
      success: true,
      userBetId: userBet.id,
      amount,
      status: 'active',
      solana_instruction: {
        instruction_type: 'place_bet',
        marketPda: marketPda.toBase58(),
        lpOfferPda: lpOfferPda.toBase58(),
        bettorPositionPda: positionPda.toBase58(),
        outcome: outcomeIndex,
        amountLamports: Math.round(amount * 1_000_000_000),
      },
      message: `Sign to place ◎${amount} on ${outcomeLabel} — pari-mutuel odds update dynamically`,
    });

  } catch (error) {
    console.error('placeBet error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});