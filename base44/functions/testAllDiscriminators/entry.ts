import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { PublicKey, Connection, Transaction, TransactionInstruction, SystemProgram } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'node:buffer';

const SOLANA_PROGRAM_ID = Deno.env.get('SOLANA_PROGRAM_ID') || '4epUYJPwoPhG9RPoQ6qT9dsAewJCDBSCGUpR1Xj9UxTm';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const programId = new PublicKey(SOLANA_PROGRAM_ID);
    
    // Derive platform PDA
    const [platformPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('platform')],
      programId
    );

    // Derive fee vault PDA
    const [feeVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('fee_vault')],
      programId
    );

    // Calculate ALL possible discriminator formats
    const discriminators = {
      global_snake: await crypto.subtle.digest('SHA-256', new TextEncoder().encode('global:initialize_platform')),
      global_camel: await crypto.subtle.digest('SHA-256', new TextEncoder().encode('global:initializePlatform')),
      simple_snake: await crypto.subtle.digest('SHA-256', new TextEncoder().encode('initialize_platform')),
      simple_camel: await crypto.subtle.digest('SHA-256', new TextEncoder().encode('initializePlatform')),
    };

    const results = [];
    
    // Test each discriminator format
    for (const [name, discBuffer] of Object.entries(discriminators)) {
      const discriminator = Buffer.from(new Uint8Array(discBuffer).slice(0, 8));
      
      // Build instruction data: discriminator (8 bytes) + fee_percent (2 bytes)
      const initData = Buffer.alloc(10);
      discriminator.copy(initData, 0);
      initData.writeUInt16LE(0, 8); // fee_percent = 0
      
      console.log(`Testing ${name}:`, discriminator.toString('hex'));
      
      try {
        // Try to simulate the instruction
        const transaction = new Transaction();
        const keys = [
          { pubkey: platformPda, isSigner: false, isWritable: true },
          { pubkey: feeVaultPda, isSigner: false, isWritable: true },
          { pubkey: new PublicKey(user.wallet_address || '11111111111111111111111111111111'), isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ];
        
        const ix = new TransactionInstruction({
          keys,
          programId,
          data: initData,
        });
        
        transaction.add(ix);
        
        // Simulate (don't actually send)
        const simResult = await connection.simulateTransaction(transaction, {
          sigVerify: false,
          commitment: 'confirmed',
        });
        
        results.push({
          format: name,
          discriminator: discriminator.toString('hex'),
          success: !simResult.value.err,
          error: simResult.value.err,
          logs: simResult.value.logs?.slice(-3),
        });
      } catch (err) {
        results.push({
          format: name,
          discriminator: discriminator.toString('hex'),
          success: false,
          error: err.message,
        });
      }
    }

    return Response.json({
      success: true,
      programId: SOLANA_PROGRAM_ID,
      platformPda: platformPda.toBase58(),
      feeVaultPda: feeVaultPda.toBase58(),
      testResults: results,
      recommended: results.find(r => r.success)?.format || 'none_worked',
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});