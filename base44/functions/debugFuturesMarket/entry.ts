import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { PublicKey, Connection } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'node:buffer';

/**
 * Debug function to check futures market state (DB + on-chain)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { marketId } = payload;
    
    if (!marketId) {
      return Response.json({ error: 'marketId required' }, { status: 400 });
    }
    
    // Fetch from DB
    const futuresMarkets = await base44.entities.FuturesMarket.filter({ id: marketId });
    const market = futuresMarkets[0];
    
    if (!market) {
      return Response.json({ error: 'Market not found in DB' }, { status: 404 });
    }
    
    // Check on-chain
    const PROGRAM_ID = Deno.env.get('SOLANA_PROGRAM_ID');
    const programId = new PublicKey(PROGRAM_ID);
    const marketIdBytes = Buffer.from(marketId.padEnd(32, '\0').slice(0, 32));
    const [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('market'), marketIdBytes],
      programId
    );
    
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const marketAccountInfo = await connection.getAccountInfo(marketPda);
    
    let onChainState = null;
    if (marketAccountInfo) {
      const marketData = marketAccountInfo.data;
      onChainState = {
        settled: marketData[244],
        voided: marketData[245],
        winning_outcome: marketData[155],
        outcomeCount: marketData[154],
        feePercent: marketData.readUInt16LE(152) / 100,
      };
    }
    
    return Response.json({
      db_state: {
        status: market.status,
        winning_outcome: market.winning_outcome,
        winning_outcome_label: market.winning_outcome_label,
        outcomes: market.outcomes,
      },
      on_chain_state: onChainState,
      marketPda: marketPda.toBase58(),
    });
    
  } catch (error) {
    console.error('debugFuturesMarket error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});