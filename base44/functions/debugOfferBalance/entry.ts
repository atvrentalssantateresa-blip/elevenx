import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { Connection, PublicKey } from 'npm:@solana/web3.js@1.98.4';

/**
 * Debug function to check on-chain LP offer balance
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { offerId } = payload;

    if (!offerId) {
      return Response.json({ error: 'Missing offerId' }, { status: 400 });
    }

    // Fetch offer from DB
    const offers = await base44.entities.BetOffer.filter({ id: offerId });
    const offer = offers[0];
    if (!offer) {
      return Response.json({ error: 'Offer not found' }, { status: 404 });
    }

    const SOLANA_PROGRAM_ID = Deno.env.get('SOLANA_PROGRAM_ID');
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

    // Check on-chain balance
    const lpOfferPubkey = new PublicKey(offer.solana_position_pda);
    const accountInfo = await connection.getAccountInfo(lpOfferPubkey);

    return Response.json({
      db_status: offer.status,
      db_amount_unmatched: offer.amount_unmatched,
      on_chain_exists: !!accountInfo,
      on_chain_lamports: accountInfo?.lamports || 0,
      on_chain_sol: (accountInfo?.lamports || 0) / 1e9,
      pda: offer.solana_position_pda,
    });

  } catch (error) {
    console.error('debugOfferBalance error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});