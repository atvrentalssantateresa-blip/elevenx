import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { PublicKey, Connection } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'node:buffer';
import { sha256 } from 'npm:@noble/hashes@1.4.0/sha256';

const SOLANA_PROGRAM_ID = Deno.env.get('SOLANA_PROGRAM_ID');

if (!SOLANA_PROGRAM_ID) {
  throw new Error('SOLANA_PROGRAM_ID secret not configured');
}

/**
 * Withdraw fees from the fee vault to admin wallet.
 * Expects: { amount_lamports: number, admin_wallet: string }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const serviceRole = base44.asServiceRole;
    
    const requestBody = await req.json();
    const { amount_lamports, admin_wallet } = requestBody;
    
    console.log('[withdrawFees] Request:', { amount_lamports, admin_wallet });
    
    if (!amount_lamports || amount_lamports <= 0) {
      return Response.json({ error: 'amount_lamports must be > 0' }, { status: 400 });
    }
    
    if (!admin_wallet) {
      return Response.json({ error: 'admin_wallet required' }, { status: 400 });
    }
    
    const programId = new PublicKey(SOLANA_PROGRAM_ID);
    
    // Derive PDAs
    const [feeVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('fee_vault')],
      programId
    );
    
    const [platformPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('platform')],
      programId
    );
    
    console.log('[withdrawFees] PDAs:', {
      fee_vault: feeVaultPda.toBase58(),
      platform: platformPda.toBase58(),
    });
    
    // Validate platform config exists and check admin
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const platformInfo = await connection.getAccountInfo(platformPda);
    
    if (!platformInfo) {
      return Response.json({ 
        error: 'Platform config not found on-chain. Run "Init Platform" first.',
        fix: 'Go to Admin > Platform tab > click "Init Platform"'
      }, { status: 400 });
    }
    
    // Extract admin from platform config (bytes 8-40)
    const adminBytes = platformInfo.data.slice(8, 40);
    const onChainAdmin = new PublicKey(adminBytes).toBase58();
    
    console.log('[withdrawFees] On-chain admin:', onChainAdmin);
    console.log('[withdrawFees] Requested admin:', admin_wallet);
    
    if (onChainAdmin !== admin_wallet) {
      return Response.json({ 
        error: 'Wallet mismatch! Your wallet is not the platform admin.',
        on_chain_admin: onChainAdmin,
        your_wallet: admin_wallet,
      }, { status: 403 });
    }
    
    // Validate fee vault exists
    const feeVaultInfo = await connection.getAccountInfo(feeVaultPda);
    if (!feeVaultInfo) {
      return Response.json({ error: 'Fee vault not found on-chain' }, { status: 400 });
    }
    
    console.log('[withdrawFees] Fee vault balance:', feeVaultInfo.lamports, 'lamports');
    
    if (amount_lamports > feeVaultInfo.lamports) {
      return Response.json({ 
        error: 'Insufficient funds in fee vault',
        requested: amount_lamports,
        available: feeVaultInfo.lamports,
      }, { status: 400 });
    }
    
    // Build instruction data: 8-byte discriminator + 8-byte amount (u64 LE)
    const discriminator = Buffer.from([198, 212, 171, 109, 144, 215, 174, 89]);
    const data = Buffer.alloc(16);
    discriminator.copy(data, 0);
    data.writeBigUInt64LE(BigInt(amount_lamports), 8);
    
    console.log('[withdrawFees] Instruction data:', data.toString('hex'));
    
    // Build accounts in exact order:
    // 1. fee_vault [writable]
    // 2. platform_config [readonly]
    // 3. admin [signer, writable]
    // 4. system_program [readonly]
    const keys = [
      { pubkey: feeVaultPda.toBase58(), isSigner: false, isWritable: true },
      { pubkey: platformPda.toBase58(), isSigner: false, isWritable: false },
      { pubkey: admin_wallet, isSigner: true, isWritable: true },
      { pubkey: '11111111111111111111111111111111', isSigner: false, isWritable: false },
    ];
    
    console.log('[withdrawFees] Accounts:', keys);
    
    return Response.json({
      success: true,
      message: `Withdraw ◎${(amount_lamports / 1e9).toFixed(6)} SOL from fee vault`,
      solana_instruction: {
        instruction_type: 'withdraw_fees',
        programId: SOLANA_PROGRAM_ID,
        keys,
        instruction_data: data.toString('base64'),
      },
      amount_lamports,
      amount_sol: amount_lamports / 1e9,
      fee_vault_pda: feeVaultPda.toBase58(),
      remaining_balance_lamports: feeVaultInfo.lamports - amount_lamports,
    });
    
  } catch (error) {
    console.error('[withdrawFees] Error:', error);
    return Response.json({ 
      error: error.message,
      error_type: error.name,
    }, { status: 500 });
  }
});