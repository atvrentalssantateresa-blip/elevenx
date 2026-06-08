import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { PublicKey, Connection } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'node:buffer';
import bs58 from 'npm:bs58@5.0.0';

const SOLANA_PROGRAM_ID = Deno.env.get('SOLANA_PROGRAM_ID') || '4epUYJPwoPhG9RPoQ6qT9dsAewJCDBSCGUpR1Xj9UxTm';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const serviceRole = base44.asServiceRole;
    
    const payload = await req.json();
    const walletAddress = payload.walletAddress;
    
    if (!walletAddress) {
      return Response.json({ error: 'Wallet address required' }, { status: 400 });
    }
    
    // Verify user is admin by checking WalletUser entity
    // Normalize wallet address for comparison (remove whitespace, lowercase)
    const normalizedWallet = walletAddress.trim().toLowerCase();
    const allWalletUsers = await serviceRole.entities.WalletUser.list();
    const walletUser = allWalletUsers.find(wu => wu.wallet_address?.trim().toLowerCase() === normalizedWallet);
    
    console.log('Wallet check:', {
      provided: walletAddress,
      normalized: normalizedWallet,
      found: !!walletUser,
      role: walletUser?.role,
      allWallets: allWalletUsers.map(w => ({ address: w.wallet_address, role: w.role })),
    });
    
    if (!walletUser || walletUser.role !== 'admin') {
      return Response.json({ 
        error: 'Admin only - this wallet is not registered as admin. Please connect the correct admin wallet or register this wallet first.',
        debug: {
          provided: walletAddress,
          found: !!walletUser,
          role: walletUser?.role,
        }
      }, { status: 403 });
    }

    console.log('Reinitializing platform with admin wallet:', walletAddress);

    const programId = new PublicKey(SOLANA_PROGRAM_ID);
    const adminPubkey = new PublicKey(walletAddress);
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

    // Derive platform config PDA
    const [platformPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('platform')],
      programId
    );

    // Derive fee vault PDA
    const [feeVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('fee_vault')],
      programId
    );

    // Check if platform already exists
    const accountInfo = await connection.getAccountInfo(platformPda);
    let isReinit = false;
    let currentAdmin = null;
    
    if (accountInfo) {
      isReinit = true;
      const data = Buffer.from(accountInfo.data);
      if (data.length >= 40) {
        currentAdmin = new PublicKey(data.slice(8, 40)).toBase58();
      }
      console.log('Platform already exists, current admin:', currentAdmin);
      
      // Platform exists - return success without needing to reinitialize
      return Response.json({
        success: true,
        isReinit: true,
        alreadyInitialized: true,
        currentAdmin,
        message: `Platform already initialized. Admin: ${currentAdmin?.slice(0, 6)}...${currentAdmin?.slice(-6)}`,
        platformPda: platformPda.toBase58(),
        feeVaultPda: feeVaultPda.toBase58(),
      });
    }

    console.log('PDAs:', {
      platformPda: platformPda.toBase58(),
      feeVaultPda: feeVaultPda.toBase58(),
      admin: adminPubkey.toBase58(),
    });

    // Platform doesn't exist - we need to initialize it
    // But the discriminator format is unknown (IDL not on-chain)
    // Return error with instructions to redeploy locally
    
    return Response.json({
      success: false,
      platformExists: false,
      error: 'Platform not initialized and discriminator format unknown',
      action_required: 'redeploy_locally',
      instructions: {
        step1: 'cd solana-programs/elevenx-betting',
        step2: 'anchor build --provider.cluster devnet',
        step3: 'anchor deploy --provider.cluster devnet',
        step4: 'anchor idl init elevenx_betting --filepath target/idl/elevenx_betting.json --provider.cluster devnet',
        step5: 'Copy the new program ID from deploy output',
        step6: 'Update SOLANA_PROGRAM_ID secret in Base44 Dashboard',
      },
      note: 'The deployed program IDL is not on-chain, so we cannot determine the correct discriminator format. You must redeploy the program locally with IDL upload.',
    });

  } catch (error) {
    console.error('reinitPlatformWithWallet error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});