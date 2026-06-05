import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const serviceRole = base44.asServiceRole;

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { walletAddress, username } = await req.json();

    if (!walletAddress) {
      return Response.json({ error: 'Wallet address required' }, { status: 400 });
    }

    // Save wallet address to User entity
    await base44.entities.User.update(user.id, {
      wallet_address: walletAddress
    });

    // Also create/update WalletUser entity (required for Solana platform recognition)
    const allWalletUsers = await serviceRole.entities.WalletUser.list();
    const existingWalletUser = allWalletUsers.find(wu => wu.wallet_address === walletAddress);

    if (existingWalletUser) {
      // Update existing WalletUser
      await serviceRole.entities.WalletUser.update(existingWalletUser.id, {
        wallet_address: walletAddress,
        username: username || user.full_name || walletAddress.slice(0, 8),
        role: user.role || 'user'
      });
    } else {
      // Create new WalletUser
      await serviceRole.entities.WalletUser.create({
        wallet_address: walletAddress,
        username: username || user.full_name || walletAddress.slice(0, 8),
        role: user.role || 'user'
      });
    }

    console.log('✓ Wallet saved - User:', user.id, 'WalletUser:', walletAddress);

    return Response.json({
      success: true,
      wallet_address: walletAddress
    });

  } catch (error) {
    console.error('saveWalletAddress error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});