import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { PublicKey, Connection } from 'npm:@solana/web3.js@1.98.4';
import bs58 from 'npm:bs58@5.0.0';

const SOLANA_PROGRAM_ID = Deno.env.get('SOLANA_PROGRAM_ID') || 'HmRP5jmZp3P7g2JH5QyYeaGZRRB6SUJm52pSzRNhwTbj';

/**
 * Fetch the Anchor IDL from on-chain to get the correct discriminator.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const programId = new PublicKey(SOLANA_PROGRAM_ID);
    
    // Anchor stores IDL at a special PDA: [program_id]
    const [idlPda] = PublicKey.findProgramAddressSync(
      [programId.toBuffer()],
      programId
    );
    
    console.log('IDL PDA:', idlPda.toBase58());
    
    const idlAccount = await connection.getAccountInfo(idlPda);
    
    if (!idlAccount) {
      return Response.json({
        success: false,
        error: 'IDL account not found on-chain',
        idlPda: idlPda.toBase58(),
        note: 'The program may have been deployed without uploading the IDL, or it uses a different IDL storage method.',
      });
    }
    
    // IDL account data structure:
    // - First 8 bytes: discriminator for IDL account itself
    // - Next 32 bytes: authority pubkey
    // - Next 32 bytes: buffer (ID)
    // - Rest: compressed IDL JSON
    
    const data = Buffer.from(idlAccount.data);
    console.log('IDL account data length:', data.length);
    console.log('First 64 bytes (hex):', data.slice(0, 64).toString('hex'));
    
    // Try to parse the IDL (skip first 72 bytes = 8 + 32 + 32)
    try {
      const idlJson = data.slice(72).toString('utf8').replace(/\0/g, '');
      const idl = JSON.parse(idlJson);
      
      console.log('IDL parsed successfully');
      console.log('IDL instructions:', idl.instructions?.map((i: any) => i.name));
      
      // Find initialize_platform instruction
      const initInstr = idl.instructions?.find((i: any) => i.name === 'initialize_platform');
      
      if (initInstr) {
        console.log('Found initialize_platform instruction');
        console.log('Args:', initInstr.args);
        
        // The discriminator is in the IDL
        const discHex = initInstr.discriminator?.value || initInstr.discriminator;
        
        return Response.json({
          success: true,
          idlFound: true,
          idlPda: idlPda.toBase58(),
          initialize_platform: {
            discriminator: discHex,
            args: initInstr.args,
          },
          allInstructions: idl.instructions?.map((i: any) => ({
            name: i.name,
            discriminator: i.discriminator?.value || i.discriminator,
          })),
        });
      }
    } catch (e) {
      console.log('Failed to parse IDL JSON:', e);
    }
    
    return Response.json({
      success: true,
      idlFound: true,
      idlPda: idlPda.toBase58(),
      idlDataLength: data.length,
      note: 'IDL exists but could not be parsed. Try manual inspection.',
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});