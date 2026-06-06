import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const serviceRole = base44.asServiceRole;
    
    // Verify admin access
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('[fixMissingUsers] Starting fix...');
    
    // Get all WalletUser records
    const allWalletUsers = await serviceRole.entities.WalletUser.list();
    console.log('[fixMissingUsers] Total WalletUser records:', allWalletUsers.length);
    
    let fixed = 0;
    let errors = 0;
    
    for (const walletUser of allWalletUsers) {
      try {
        // Check if User entity exists for this wallet
        const users = await serviceRole.entities.User.filter({ 
          wallet_address: walletUser.wallet_address 
        });
        
        if (users.length === 0) {
          // User entity missing - create it
          const newUser = await serviceRole.entities.User.create({
            email: `${walletUser.wallet_address.slice(0, 8)}@elevenx.bet`,
            full_name: `User ${walletUser.wallet_address.slice(0, 8)}`,
            wallet_address: walletUser.wallet_address,
            username: walletUser.wallet_address.slice(0, 8),
            role: walletUser.role || 'user',
          });
          console.log(`[fixMissingUsers] ✓ Created User for wallet ${walletUser.wallet_address.slice(0, 8)}... - id: ${newUser.id}`);
          fixed++;
        }
      } catch (err) {
        console.error(`[fixMissingUsers] ✗ Error processing wallet ${walletUser.wallet_address}:`, err.message);
        errors++;
      }
    }
    
    console.log('[fixMissingUsers] Fix complete:', { fixed, errors, total: allWalletUsers.length });
    
    return Response.json({
      success: true,
      fixed,
      errors,
      total: allWalletUsers.length,
    });
  } catch (error) {
    console.error('[fixMissingUsers] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});