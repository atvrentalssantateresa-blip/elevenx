import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Finalizes claim after Solana transaction is confirmed.
 * Uses service role to bypass RLS and update database reliably.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { userBetId, batchBetIds, signature } = payload;

    if (!userBetId && !batchBetIds) {
      return Response.json({ error: 'Missing userBetId or batchBetIds' }, { status: 400 });
    }

    const betIdsToUpdate = batchBetIds || [userBetId];
    const updated = [];

    for (const id of betIdsToUpdate) {
      const bet = (await base44.asServiceRole.entities.UserBet.filter({ id }))[0];
      if (bet) {
        await base44.asServiceRole.entities.UserBet.update(id, {
          status: 'claimed',
          actual_payout: bet.potential_payout || 0,
        });
        updated.push(id);
      }
    }

    console.log(`✓ Finalized claim: ${updated.length} bet(s) marked as claimed`);

    return Response.json({
      success: true,
      updatedBetIds: updated,
      signature,
    });
  } catch (error) {
    console.error('finalizeClaim error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});