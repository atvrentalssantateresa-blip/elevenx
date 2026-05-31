import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { walletAddress } = await req.json();

    if (!walletAddress) {
      return Response.json({ error: 'Wallet address required' }, { status: 400 });
    }

    // Save wallet address to user profile
    await base44.entities.User.update(user.id, {
      wallet_address: walletAddress
    });

    return Response.json({
      success: true,
      wallet_address: walletAddress
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});