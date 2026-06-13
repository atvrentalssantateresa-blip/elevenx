import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { PublicKey, Connection } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'node:buffer';

/**
 * Scan all LP offers for a specific market on-chain
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const serviceRole = base44.asServiceRole;
    
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { marketPda, match_id } = body;

    if (!marketPda && !match_id) {
      return Response.json({ error: 'Missing marketPda or match_id' }, { status: 400 });
    }

    // Get market PDA
    let targetMarketPda = marketPda;
    if (match_id) {
      const programId = new PublicKey(Deno.env.get('ELEVENX_PROGRAM_ID'));
      const matchIdBytes = Buffer.alloc(32);
      Buffer.from(match_id, 'utf-8').copy(matchIdBytes, 0, 0, Math.min(match_id.length, 32));
      const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from('market'), matchIdBytes],
        programId
      );
      targetMarketPda = pda.toBase58();
    }

    console.log('[scanMarketLpOffers] Scanning market:', targetMarketPda);

    const rpcUrl = Deno.env.get('SOLANA_RPC_URL') || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');
    const programId = new PublicKey(Deno.env.get('ELEVENX_PROGRAM_ID'));

    // Fetch all program accounts and filter for lp_offer PDAs
    const allAccounts = await connection.getProgramAccounts(programId, {
      filters: [{
        dataSize: 98 // lp_offer account size
      }]
    });

    console.log('[scanMarketLpOffers] Found', allAccounts.length, 'lp_offer accounts');

    const marketOffers = [];
    
    for (const account of allAccounts) {
      try {
        const data = account.account.data;
        if (data.length < 98) continue;

        // Parse lp_offer account
        const marketPdaOnChain = new PublicKey(data.slice(1, 33)).toBase58();
        
        // Only show offers for this market
        if (marketPdaOnChain !== targetMarketPda) continue;

        const lpWallet = new PublicKey(data.slice(33, 65)).toBase58();
        const committed = Number(data.readBigUInt64LE(65));
        const matched = Number(data.readBigUInt64LE(73));
        const closed = data[97] === 1;
        
        // Outcome is at byte 81 (u8)
        const outcomeNum = data[81];
        const outcome = outcomeNum === 0 ? 'a' : outcomeNum === 1 ? 'b' : 'draw';

        marketOffers.push({
          pda: account.pubkey.toBase58(),
          lpWallet,
          committed: committed / 1e9,
          matched: matched / 1e9,
          unmatched: (committed - matched) / 1e9,
          closed,
          outcome,
          outcomeNum,
        });
      } catch (err) {
        console.log('[scanMarketLpOffers] Parse error:', err.message);
      }
    }

    // Also fetch DB offers for comparison
    const dbOffers = await serviceRole.entities.BetOffer.filter({ match_id: match_id || 'unknown' });

    return Response.json({
      marketPda: targetMarketPda,
      onChainOffers: marketOffers,
      dbOffers: dbOffers.map(o => ({
        id: o.id,
        outcome: o.outcome,
        outcome_label: o.outcome_label,
        amount_unmatched: o.amount_unmatched,
        status: o.status,
        solana_position_pda: o.solana_position_pda,
      })),
      summary: {
        totalOnChain: marketOffers.length,
        totalDb: dbOffers.length,
        byOutcome: {
          a: marketOffers.filter(o => o.outcome === 'a' && !o.closed).length,
          b: marketOffers.filter(o => o.outcome === 'b' && !o.closed).length,
          draw: marketOffers.filter(o => o.outcome === 'draw' && !o.closed).length,
        }
      }
    });

  } catch (error) {
    console.error('[scanMarketLpOffers] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});