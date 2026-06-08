import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { PublicKey, Connection, Transaction, SystemProgram, TransactionInstruction } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'node:buffer';

const SOLANA_PROGRAM_ID = Deno.env.get('SOLANA_PROGRAM_ID');

async function computeDiscriminator(input) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Buffer.from(new Uint8Array(hash).slice(0, 8));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const programId = new PublicKey(SOLANA_PROGRAM_ID);
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

    const [platformPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('platform')],
      programId
    );

    const [feeVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('fee_vault')],
      programId
    );

    const discriminators = {
      global_snake: await computeDiscriminator('global:initialize_platform'),
      global_camel: await computeDiscriminator('global:initializePlatform'),
      simple_snake: await computeDiscriminator('initialize_platform'),
      simple_camel: await computeDiscriminator('initializePlatform'),
    };

    console.log('Testing discriminator formats...');
    console.log('Program ID:', SOLANA_PROGRAM_ID);
    console.log('Platform PDA:', platformPda.toBase58());

    const results = [];

    for (const [name, disc] of Object.entries(discriminators)) {
      const initData = Buffer.alloc(10);
      disc.copy(initData, 0);
      initData.writeUInt16LE(0, 8);

      const keys = [
        { pubkey: platformPda, isSigner: false, isWritable: true },
        { pubkey: feeVaultPda, isSigner: false, isWritable: true },
        { pubkey: user.wallet_address ? new PublicKey(user.wallet_address) : programId, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ];

      const testIx = new TransactionInstruction({
        keys,
        programId,
        data: initData,
      });

      const transaction = new Transaction();
      transaction.add(testIx);
      
      try {
        const simResult = await connection.simulateTransaction(transaction, {
          accounts: {
            encoding: 'base64',
            addresses: [platformPda.toBase58(), feeVaultPda.toBase58()],
          },
        });

        results.push({
          format: name,
          discriminator: disc.toString('hex'),
          success: !simResult.value.err,
          error: simResult.value.err ? JSON.stringify(simResult.value.err) : null,
          logs: simResult.value.logs?.slice(-3) || [],
        });
      } catch (simError) {
        results.push({
          format: name,
          discriminator: disc.toString('hex'),
          success: false,
          error: simError.message,
        });
      }
    }

    return Response.json({
      programId: SOLANA_PROGRAM_ID,
      platformPda: platformPda.toBase58(),
      feeVaultPda: feeVaultPda.toBase58(),
      testResults: results,
      recommendation: results.find(r => r.success)?.format || 'All formats failed',
    });

  } catch (error) {
    console.error('testDiscriminators error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});