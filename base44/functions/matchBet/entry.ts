import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Match against an existing offer — bettor takes the opposing side
// Bettor stakes at opposing odds: if LP offered Home @ 2.0, bettor bets Away
// LP's liability covers bettor's winnings

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { offer_id, amount, wallet_address } = body;

    if (!offer_id || !amount || amount <= 0) {
      return Response.json({ error: 'Missing offer_id or amount' }, { status: 400 });
    }

    // Load offer
    const offers = await base44.entities.BetOffer.filter({ id: offer_id });
    const offer = offers[0];
    if (!offer) return Response.json({ error: 'Offer not found' }, { status: 404 });
    if (offer.status === 'cancelled' || offer.status === 'fully_matched') {
      return Response.json({ error: 'Offer is no longer available' }, { status: 400 });
    }

    // Load bet/market
    const bets = await base44.entities.Bet.filter({ id: offer.bet_id });
    const bet = bets[0];
    if (!bet || bet.status !== 'open') return Response.json({ error: 'Market not open' }, { status: 400 });

    // The opposing outcome(s): if LP backed 'a', matcher bets 'b' or 'draw'
    // For simplicity: matcher always takes the exact opposite of the offer
    // Max the bettor can stake = offer.amount_unmatched * (lp_odds - 1) / lp_odds
    // because LP put up: amount, which covers payout of amount * lp_odds
    // bettor's stake to cover = amount_unmatched / (lp_odds - 1) * something
    // 
    // Fixed-odds P2P math:
    //   LP offers outcome A @ odds 2.0, puts up 100 SOL
    //   If LP wins: LP gets bettor's stake (100 SOL @ 2.0 → bettor could put max 100 SOL to win 200)
    //   Wait — bettor puts 100, LP puts 100 (their liability = their stake since odds=2.0)
    //   Actually: LP stake = their potential payout if they LOSE = what bettor wins
    //   So: LP puts 100 @ odds 2.0 → LP wins 100*(2.0-1)=100 if win, loses 100 if they lose
    //   Bettor stakes X to win LP's 100 → bettor's odds = 100/X + 1
    //   But odds are fixed at creation. LP odds = 2.0 means bettor odds = 1/(1-1/2.0) = 2.0 (even money)
    //   Cleaner: LP_odds + Bettor_odds form a matched pair
    //   LP backs A @ 2.0: bettor must take NOT-A. 
    //   Max bettor can stake = LP_stake (amount_unmatched) since odds=2 is even money.
    //   General: max_bettor_stake = amount_unmatched (LP's liability IS their stake at 2x)
    //   For non-2x: LP puts up `liability`, bettor puts up `stake` such that:
    //     stake * bettor_odds = liability + stake (bettor wins LP's liability)
    //     LP's liability = LP_stake * (LP_odds - 1)
    //   So max_bettor_stake = LP_stake * (LP_odds - 1) / some bettor_odds
    //   Simplest model: max bettor stake = offer.amount_unmatched * (offer.odds_at_creation - 1)
    //   That way bettor puts up less, and if bettor wins they get LP's stake back + their own

    const maxBettorStake = offer.amount_unmatched * (offer.odds_at_creation - 1);

    if (amount > maxBettorStake + 0.000001) {
      return Response.json({
        error: `Max you can bet against this offer is ◎${maxBettorStake.toFixed(4)}`,
        max_stake: maxBettorStake,
      }, { status: 400 });
    }

    // How much of LP's offer is being consumed
    const lpStakeConsumed = amount / (offer.odds_at_creation - 1);
    const newUnmatched = Math.max(0, offer.amount_unmatched - lpStakeConsumed);
    const newMatched = (offer.amount_matched || 0) + lpStakeConsumed;

    // Bettor's payout if they win = their stake + LP's consumed stake
    const bettorPayout = amount + lpStakeConsumed;

    // Determine bettor's outcome (opposite of LP's)
    let bettorOutcome;
    if (offer.outcome === 'a') bettorOutcome = 'b';
    else if (offer.outcome === 'b') bettorOutcome = 'a';
    else bettorOutcome = 'a'; // draw -> home team

    const bettorOutcomeLabel = bettorOutcome === 'a' ? bet.outcome_a : bettorOutcome === 'b' ? bet.outcome_b : 'Draw';

    // Update the offer
    const newStatus = newUnmatched < 0.000001 ? 'fully_matched' : 'partially_matched';
    await base44.entities.BetOffer.update(offer_id, {
      amount_matched: newMatched,
      amount_unmatched: newUnmatched,
      status: newStatus,
    });

    // Create UserBet for the matcher
    const matcherBet = await base44.entities.UserBet.create({
      bet_id: offer.bet_id,
      match_id: offer.match_id,
      offer_id,
      role: 'matcher',
      outcome: bettorOutcome,
      amount,
      potential_payout: parseFloat(bettorPayout.toFixed(6)),
      status: 'active', // immediately locked
      outcome_label: bettorOutcomeLabel,
      match_title: `${bet.outcome_a} vs ${bet.outcome_b}`,
      wallet_address: wallet_address || null,
    });

    // Update LP's UserBet status to active (partial or full match)
    const lpBets = await base44.entities.UserBet.filter({ offer_id, role: 'lp' });
    if (lpBets[0]) {
      await base44.entities.UserBet.update(lpBets[0].id, { status: 'active' });
    }

    // Update pool stats
    const poolField = bettorOutcome === 'a' ? 'pool_a' : bettorOutcome === 'b' ? 'pool_b' : 'pool_draw';
    await base44.entities.Bet.update(offer.bet_id, {
      [poolField]: (bet[poolField] || 0) + amount,
      total_pool: (bet.total_pool || 0) + amount,
      total_bettors: (bet.total_bettors || 0) + 1,
    });

    return Response.json({
      success: true,
      user_bet_id: matcherBet.id,
      payout_if_win: bettorPayout,
      lp_stake_consumed: lpStakeConsumed,
      remaining_in_offer: newUnmatched,
      message: `Bet matched! You staked ◎${amount} to win ◎${bettorPayout.toFixed(4)} if ${bettorOutcomeLabel} wins.`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});