import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const walletAddress = payload.walletAddress;
    
    if (!walletAddress) {
      return Response.json({ error: 'Wallet address required' }, { status: 400 });
    }

    console.log('Registering wallet as admin:', walletAddress);

    // Check if wallet already exists
    const existingUsers = await base44.asServiceRole.entities.WalletUser.filter({
      wallet_address: walletAddress
    });

    if (existingUsers.length > 0) {
      // Update existing user to admin
      const updated = await base44.asServiceRole.entities.WalletUser.update(
        existingUsers[0].id,
        { role: 'admin' }
      );
      return Response.json({
        success: true,
        message: 'Wallet updated to admin role',
        wallet: walletAddress,
        action: 'updated',
      });
    }

    // Create new admin user
    const newUser = await base44.asServiceRole.entities.WalletUser.create({
      wallet_address: walletAddress,
      username: 'Admin',
      role: 'admin',
      total_bets: 0,
      total_won: 0,
      total_staked: 0,
    });

    return Response.json({
      success: true,
      message: 'Wallet registered as admin',
      wallet: walletAddress,
      action: 'created',
      userId: newUser.id,
    });

  } catch (error) {
    console.error('registerAdminWallet error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});