import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { Connection, PublicKey, Transaction, SystemProgram, TransactionInstruction } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'node:buffer';
import { sha256 } from 'npm:@noble/hashes@1.4.0/sha256';

const SOLANA_PROGRAM_ID = Deno.env.get('SOLANA_PROGRAM_ID') || 'wBhZVzWqxZ13NtbSAXE4nx2RLcBhS3v2nPoN7MXq9f7';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const programId = new PublicKey(SOLANA_PROGRAM_ID);
    
    // Derive platform PDA
    const [platformPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('platform')],
      programId
    );
    
    // Test both discriminator formats with a real transaction
    const discriminatorTests = [
      { name: 'global:force_settle_market', input: 'global:force_settle_market' },
      { name: 'force_settle_market', input: 'force_settle_market' },
      { name: 'global:submit_oracle_vote', input: 'global:submit_oracle_vote' },
      { name: 'submit_oracle_vote', input: 'submit_oracle_vote' },
    ];
    
    const results = [];
    
    for (const test of discriminatorTests) {
      const discBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(test.input));
      const discriminator = Buffer.from(new Uint8Array(discBuffer).slice(0, 8));
      
      // Create a test instruction with minimal valid data (outcome = 0)
      const testData = Buffer.alloc(9);
      discriminator.copy(testData, 0);
      testData.writeUInt8(0, 8); // outcome index 0
      
      results.push({
        format: test.name,
        discriminator: discriminator.toString('hex'),
        dataHex: testData.toString('hex'),
      });
    }
    
    // Fetch the actual program account to check if it's deployed
    const programAccount = await connection.getAccountInfo(programId);
    
    return Response.json({
      success: true,
      programId: SOLANA_PROGRAM_ID,
      programDeployed: !!programAccount,
      programOwner: programAccount?.owner.toBase58(),
      platformPda: platformPda.toBase58(),
      discriminatorTests: results,
      recommendation: 'Use the FIRST discriminator format (global:force_settle_market) - Anchor 0.29+ uses "global:" prefix by default',
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});