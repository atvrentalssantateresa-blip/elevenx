import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { PublicKey } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'npm:buffer@6.0.3';

/**
 * Admin-only: Prepare withdraw_fees instruction to sweep SOL from fee vault to admin wallet.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const payload = await req.json();
    const amountSOL = payload.amount_sol;
    const amountLamports = Math.floor(amountSOL * 1e9);

    const programId = new PublicKey(Deno.env.get('SOLANA_PROGRAM_ID'));
    const [feeVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('fee_vault')],
      programId
    );
    const [platformPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('platform')],
      programId
    );

    // Compute Anchor 8-byte discriminator for "withdraw_fees"
    const msg = new TextEncoder().encode("global:withdraw_fees");
    const hash = await crypto.subtle.digest('SHA-256', msg);
    const discriminator = Buffer.from(new Uint8Array(hash).slice(0, 8));

    // Instruction Data: Discriminator (8 bytes) + Amount (u64 LE, 8 bytes) = 16 bytes
    const instructionData = Buffer.alloc(16);
    discriminator.copy(instructionData, 0);
    instructionData.writeBigUInt64LE(BigInt(amountLamports), 8);

    console.log('[withdrawFees] Prepared instruction:', {
      amountSOL,
      amountLamports,
      feeVaultPda: feeVaultPda.toBase58(),
      platformPda: platformPda.toBase58(),
      discriminator: discriminator.toString('hex'),
      instructionData: instructionData.toString('hex'),
    });

    return Response.json({
      success: true,
      solana_instruction: {
        instruction_type: 'withdraw_fees',
        programId: programId.toBase58(),
        instruction_data: instructionData.toString('base64'),
        keys: [
          { pubkey: feeVaultPda.toBase58(), isSigner: false, isWritable: true },
          { pubkey: platformPda.toBase58(), isSigner: false, isWritable: false },
          { pubkey: 'SIGNER_WALLET', isSigner: true, isWritable: true },
          { pubkey: '11111111111111111111111111111111', isSigner: false, isWritable: false },
        ]
      }
    });
  } catch (error) {
    console.error('[withdrawFees] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});