import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { Connection, PublicKey, Transaction, SystemProgram } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'node:buffer';

const SOLANA_PROGRAM_ID = Deno.env.get('SOLANA_PROGRAM_ID') || 'HmRP5jmZp3P7g2JH5QyYeaGZRRB6SUJm52pSzRNhwTbj';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const programId = new PublicKey(SOLANA_PROGRAM_ID);
    
    // Derive PDAs
    const [platformPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('platform')],
      programId
    );
    
    const [feeVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('fee_vault')],
      programId
    );
    
    // Test all possible discriminator formats
    const possibleDiscriminators = [
      { name: 'global:initialize_platform', input: 'global:initialize_platform' },
      { name: 'initialize_platform', input: 'initialize_platform' },
      { name: 'global:InitializePlatform', input: 'global:InitializePlatform' },
      { name: 'InitializePlatform', input: 'InitializePlatform' },
      { name: 'global:initializePlatform', input: 'global:initializePlatform' },
      { name: 'initializePlatform', input: 'initializePlatform' },
    ];
    
    const results = [];
    
    for (const disc of possibleDiscriminators) {
      const discBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(disc.input));
      const discriminator = Buffer.from(new Uint8Array(discBuffer).slice(0, 8));
      
      // Build instruction data
      const initData = Buffer.alloc(10);
      discriminator.copy(initData, 0);
      initData.writeUInt16LE(0, 8); // fee_percent = 0
      
      results.push({
        name: disc.name,
        input: disc.input,
        discriminator: discriminator.toString('hex'),
        dataHex: initData.toString('hex'),
      });
    }
    
    return Response.json({
      success: true,
      programId: SOLANA_PROGRAM_ID,
      platformPda: platformPda.toBase58(),
      feeVaultPda: feeVaultPda.toBase58(),
      possibleDiscriminators: results,
      note: 'Try each discriminator format. The correct one should match what Anchor 0.30.1 generates for the initialize_platform instruction.',
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});