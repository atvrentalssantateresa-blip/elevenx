import { Connection, PublicKey } from 'npm:@solana/web3.js@1.98.4';

const SOLANA_PROGRAM_ID = Deno.env.get('SOLANA_PROGRAM_ID') || 'HmRP5jmZp3P7g2JH5QyYeaGZRRB6SUJm52pSzRNhwTbj';

Deno.serve(async (req) => {
  try {
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const programId = new PublicKey(SOLANA_PROGRAM_ID);
    
    console.log('Checking program:', SOLANA_PROGRAM_ID);
    
    const programInfo = await connection.getAccountInfo(programId);
    
    if (!programInfo) {
      return Response.json({
        success: false,
        error: 'Program not found on Solana devnet',
        searchedProgramId: SOLANA_PROGRAM_ID,
        suggestions: [
          'Verify the program ID is correct',
          'Check if the program was deployed to devnet (not mainnet or testnet)',
          'Redeploy the program using: anchor deploy --provider.cluster devnet',
        ],
      });
    }
    
    console.log('Program found!');
    console.log('  Lamports:', programInfo.lamports);
    console.log('  Data length:', programInfo.data.length);
    console.log('  Executable:', programInfo.executable);
    
    return Response.json({
      success: true,
      programId: SOLANA_PROGRAM_ID,
      programExists: true,
      lamports: programInfo.lamports,
      dataLength: programInfo.data.length,
      executable: programInfo.executable,
      owner: programInfo.owner.toBase58(),
      note: 'Program exists on devnet. The discriminator issue may be due to Anchor version mismatch or incorrect discriminator calculation.',
    });

  } catch (error) {
    return Response.json({ 
      error: error.message,
    }, { status: 500 });
  }
});