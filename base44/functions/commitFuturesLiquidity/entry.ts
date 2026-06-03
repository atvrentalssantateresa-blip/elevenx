import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Commits futures liquidity to DB after successful Solana transaction.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { signature, commit_data } = await req.json();

    if (!signature || !commit_data) {
      return Response.json({ error: 'Missing signature or commit_data' }, { status: 400 });
    }

    // Update UserBet status to active
    await base44.entities.UserBet.update(commit_data.userBetId, {
      status: 'active',
    });

    // Update BetOffer if exists, or create it
    const existingOffer = await base44.entities.BetOffer.filter({ id: commit_data.offerId }).then(offers => offers[0]);
    
    if (existingOffer) {
      await base44.entities.BetOffer.update(commit_data.offerId, {
        amount_matched: (existingOffer.amount_matched || 0) + commit_data.amount,
        status: 'partially_matched',
      });
    } else {
      await base44.entities.BetOffer.create({
        id: commit_data.offerId,
        bet_id: commit_data.market_id,
        match_id: commit_data.market_id,
        outcome: 'a',
        outcome_label: commit_data.outcome_label,
        amount_offered: commit_data.amount,
        amount_matched: commit_data.amount,
        amount_unmatched: 0,
        status: 'partially_matched',
        odds_at_creation: commit_data.odds,
        lp_wallet_address: commit_data.walletAddress,
      });
    }

    // Update FuturesMarket outcome pool
    const market = await base44.entities.FuturesMarket.get(commit_data.market_id);
    if (market && market.outcomes) {
      const outcomeIdx = market.outcomes.findIndex(o => o.label === commit_data.outcome_label);
      if (outcomeIdx !== -1) {
        market.outcomes[outcomeIdx].pool = (market.outcomes[outcomeIdx].pool || 0) + commit_data.amount;
        market.outcomes[outcomeIdx].lp_offers = (market.outcomes[outcomeIdx].lp_offers || 0) + 1;
        market.total_volume = (market.total_volume || 0) + commit_data.amount;
        await base44.entities.FuturesMarket.update(commit_data.market_id, {
          outcomes: market.outcomes,
          total_volume: market.total_volume,
        });
      }
    }

    return Response.json({ success: true, userBetId: commit_data.userBetId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});