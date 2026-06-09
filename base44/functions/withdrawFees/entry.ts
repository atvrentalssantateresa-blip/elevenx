import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { PublicKey } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'npm:buffer@6.0.3';

/**
 * Admin-only: Prepare withdraw_fees instruction using CORRECT "global:" prefix format.
 * Your deployed program: 9nwxZGK9nceBL1hPHDgyKeEkvGVjKuHY3Cq6vADXQ7GS
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const payload = await req.json();
    const { amount_sol } = payload;
    const amountLamports = Math.floor((amount_sol || 0) * 1e9);

    const SOLANA_PROGRAM_ID = Deno.env.get('SOLANA_PROGRAM_ID');
    if (!SOLANA_PROGRAM_ID) {
      return Response.json({ error: 'SOLANA_PROGRAM_ID secret not set' }, { status: 500 });
    }

    const programId = new PublicKey(SOLANA_PROGRAM_ID);
    const [feeVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('fee_vault')],
      programId
    );
    const [platformPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('platform')],
      programId
    );

    // CRITICAL: Use "global:" prefix format (Anchor 0.29+ default)
    const msg = new TextEncoder().encode("global:withdraw_fees");
    const hash = await crypto.subtle.digest('SHA-256', msg);
    const discriminator = Buffer.from(new Uint8Array(hash).slice(0, 8));

    console.log('[withdrawFees] Using program:', SOLANA_PROGRAM_ID);
    console.log('[withdrawFees] Discriminator:', discriminator.toString('hex'));

    // Instruction Data: Discriminator (8 bytes) + Amount (u64 LE, 8 bytes) = 16 bytes
    const instructionData = Buffer.alloc(16);
    discriminator.copy(instructionData, 0);
    instructionData.writeBigUInt64LE(BigInt(amountLamports), 8);

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