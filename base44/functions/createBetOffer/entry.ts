import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Create a new bet offer (P2P fixed-odds model)
// The LP/bettor puts up funds for a specific outcome at locked-in odds
// The offer sits unmatched until someone bets the other side

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { bet_id, match_id, outcome, amount, wallet_address } = body;

    if (!bet_id || !match_id || !outcome || !amount || amount <= 0) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Load the bet/market
    const bets = await base44.entities.Bet.filter({ id: bet_id });
    const bet = bets[0];
    if (!bet) return Response.json({ error: 'Bet market not found' }, { status: 404 });
    if (bet.status !== 'open') return Response.json({ error: 'Market is not open' }, { status: 400 });

    // Get the odds for this outcome
    let odds = 0;
    if (outcome === 'a') odds = bet.odds_a || 0;
    else if (outcome === 'b') odds = bet.odds_b || 0;
    else if (outcome === 'draw') odds = bet.odds_draw || 0;

    if (!odds || odds <= 1) return Response.json({ error: 'No valid odds for this outcome' }, { status: 400 });

    // Max payout the offer creator could win = amount * odds
    // The other side can bet at most: amount * (odds - 1) against this offer
    // (they put up less, they win the offer creator's stake if they win)
    const max_liability = parseFloat((amount * (odds - 1)).toFixed(6));

    // Create the BetOffer record
    const offer = await base44.entities.BetOffer.create({
      bet_id,
      match_id,
      outcome,
      outcome_label: outcome === 'a' ? bet.outcome_a : outcome === 'b' ? bet.outcome_b : 'Draw',
      amount_offered: amount,
      amount_matched: 0,
      amount_unmatched: amount,
      status: 'open',
      odds_at_creation: odds,
      lp_wallet_address: wallet_address || null,
    });

    // Create the UserBet record for the offer creator (LP side)
    const userBet = await base44.entities.UserBet.create({
      bet_id,
      match_id,
      offer_id: offer.id,
      role: 'lp',
      outcome,
      amount,
      potential_payout: parseFloat((amount * odds).toFixed(6)),
      status: 'pending', // unmatched
      outcome_label: outcome === 'a' ? bet.outcome_a : outcome === 'b' ? bet.outcome_b : 'Draw',
      match_title: `${bet.outcome_a} vs ${bet.outcome_b}`,
      wallet_address: wallet_address || null,
    });

    // Update bet pool stats
    const poolUpdate = {};
    if (outcome === 'a') poolUpdate.pool_a = (bet.pool_a || 0) + amount;
    else if (outcome === 'b') poolUpdate.pool_b = (bet.pool_b || 0) + amount;
    else poolUpdate.pool_draw = (bet.pool_draw || 0) + amount;
    poolUpdate.total_pool = (bet.total_pool || 0) + amount;
    poolUpdate.total_bettors = (bet.total_bettors || 0) + 1;
    await base44.entities.Bet.update(bet_id, poolUpdate);

    return Response.json({
      success: true,
      offer_id: offer.id,
      user_bet_id: userBet.id,
      max_liability,
      odds,
      message: `Offer created. Up to ◎${max_liability.toFixed(4)} can be bet against your position.`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});