import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const serviceRole = base44.asServiceRole;
    
    // Fetch all WalletUser records
    const allWalletUsers = await serviceRole.entities.WalletUser.list();
    console.log('Total WalletUser records:', allWalletUsers.length);
    
    const fixed = [];
    const alreadyOk = [];
    const errors = [];
    
    for (const wu of allWalletUsers) {
      const walletAddress = wu.wallet_address;
      
      // Check if platform User exists for this wallet
      const users = await serviceRole.entities.User.filter({ wallet_address: walletAddress });
      
      if (users.length === 0) {
        // Create missing User record
        try {
          const newUser = await serviceRole.entities.User.create({
            email: `${walletAddress.slice(0, 8)}@elevenx.bet`,
            full_name: `User ${walletAddress.slice(0, 8)}`,
            wallet_address: walletAddress,
            username: walletAddress.slice(0, 8),
            role: 'user',
          });
          fixed.push({
            wallet: walletAddress.slice(0, 8) + '...',
            userId: newUser.id,
          });
          console.log('✓ Created User for wallet:', walletAddress.slice(0, 8));
        } catch (err) {
          errors.push({
            wallet: walletAddress.slice(0, 8) + '...',
            error: err.message,
          });
          console.error('✗ Failed to create User for wallet:', walletAddress.slice(0, 8), err.message);
        }
      } else {
        alreadyOk.push({
          wallet: walletAddress.slice(0, 8) + '...',
          userId: users[0].id,
        });
      }
    }
    
    return Response.json({
      summary: {
        totalWalletUsers: allWalletUsers.length,
        fixed: fixed.length,
        alreadyOk: alreadyOk.length,
        errors: errors.length,
      },
      fixed,
      alreadyOk,
      errors,
    });
    
  } catch (error) {
    console.error('fixMissingUsers error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});