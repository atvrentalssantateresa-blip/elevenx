import { Connection, PublicKey } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'node:buffer';

Deno.serve(async (req) => {
  try {
    const SOLANA_PROGRAM_ID = Deno.env.get('ELEVENX_PROGRAM_ID');
    const SOLANA_RPC_URL = Deno.env.get('SOLANA_RPC_URL');
    if (!SOLANA_PROGRAM_ID || !SOLANA_RPC_URL) {
      return Response.json({ error: 'ELEVENX_PROGRAM_ID or SOLANA_RPC_URL secret not set' }, { status: 500 });
    }
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
    const programId = new PublicKey(SOLANA_PROGRAM_ID);
    
    // Check OLD platform PDA (platform_v1)
    const [oldPlatformPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('platform')],
      programId
    );
    
    // Check NEW platform PDA (platform_v2)
    const [newPlatformPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('platform_v2')],
      programId
    );
    
    const oldAccount = await connection.getAccountInfo(oldPlatformPda);
    const newAccount = await connection.getAccountInfo(newPlatformPda);
    
    console.log('OLD Platform PDA:', oldPlatformPda.toBase58());
    console.log('NEW Platform PDA:', newPlatformPda.toBase58());
    console.log('Old account exists:', !!oldAccount);
    console.log('New account exists:', !!newAccount);
    
    if (oldAccount) {
      console.log('Old account owner:', oldAccount.owner.toBase58());
      console.log('Old account executable:', oldAccount.executable);
    }
    
    if (newAccount) {
      console.log('New account owner:', newAccount.owner.toBase58());
      console.log('New account executable:', newAccount.executable);
    }
    
    return Response.json({
      success: true,
      programId: SOLANA_PROGRAM_ID,
      oldPlatformPda: oldPlatformPda.toBase58(),
      newPlatformPda: newPlatformPda.toBase58(),
      oldAccount: oldAccount ? {
        exists: true,
        owner: oldAccount.owner.toBase58(),
        executable: oldAccount.executable,
        lamports: oldAccount.lamports,
      } : { exists: false },
      newAccount: newAccount ? {
        exists: true,
        owner: newAccount.owner.toBase58(),
        executable: newAccount.executable,
        lamports: newAccount.lamports,
      } : { exists: false },
      recommendation: !newAccount ? 'Use initPlatformV2 to create new platform account' : 'Platform V2 already exists',
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});