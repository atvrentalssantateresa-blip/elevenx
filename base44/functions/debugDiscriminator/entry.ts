import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { PublicKey, Connection } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'node:buffer';

const SOLANA_PROGRAM_ID = Deno.env.get('SOLANA_PROGRAM_ID') || 'HmRP5jmZp3P7g2JH5QyYeaGZRRB6SUJm52pSzRNhwTbj';

/**
 * Debug function to check what discriminator format the deployed program expects.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const serviceRole = base44.asServiceRole;
    
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const programId = new PublicKey(SOLANA_PROGRAM_ID);
    
    // Check if program is deployed
    const programInfo = await connection.getAccountInfo(programId);
    if (!programInfo) {
      return Response.json({
        error: 'Program not deployed at this address',
        programId: SOLANA_PROGRAM_ID,
      }, { status: 404 });
    }
    
    console.log('Program is deployed:', SOLANA_PROGRAM_ID);
    
    // Derive platform PDA
    const [platformPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('platform')],
      programId
    );
    
    // Check if platform exists
    const platformInfo = await connection.getAccountInfo(platformPda);
    
    // Calculate ALL discriminator formats
    const discGlobalSnake = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('global:initialize_platform'));
    const discGlobalCamel = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('global:initializePlatform'));
    const discSimpleSnake = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('initialize_platform'));
    const discSimpleCamel = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('initializePlatform'));
    
    const discriminatorGlobalSnake = Buffer.from(new Uint8Array(discGlobalSnake).slice(0, 8));
    const discriminatorGlobalCamel = Buffer.from(new Uint8Array(discGlobalCamel).slice(0, 8));
    const discriminatorSimpleSnake = Buffer.from(new Uint8Array(discSimpleSnake).slice(0, 8));
    const discriminatorSimpleCamel = Buffer.from(new Uint8Array(discSimpleCamel).slice(0, 8));
    
    return Response.json({
      success: true,
      programId: SOLANA_PROGRAM_ID,
      programDeployed: true,
      platformPda: platformPda.toBase58(),
      platformExists: platformInfo !== null,
      platformData: platformInfo ? {
        lamports: platformInfo.lamports,
        dataLength: platformInfo.data.length,
        owner: platformInfo.owner.toBase58(),
        dataHex: platformInfo.data.slice(0, 32).toString('hex'),
      } : null,
      discriminators: {
        global_snake_case: {
          input: 'global:initialize_platform',
          hex: discriminatorGlobalSnake.toString('hex'),
          base64: discriminatorGlobalSnake.toString('base64'),
        },
        global_camel_case: {
          input: 'global:initializePlatform',
          hex: discriminatorGlobalCamel.toString('hex'),
          base64: discriminatorGlobalCamel.toString('base64'),
        },
        simple_snake_case: {
          input: 'initialize_platform',
          hex: discriminatorSimpleSnake.toString('hex'),
          base64: discriminatorSimpleSnake.toString('base64'),
        },
        simple_camel_case: {
          input: 'initializePlatform',
          hex: discriminatorSimpleCamel.toString('hex'),
          base64: discriminatorSimpleCamel.toString('base64'),
        },
      },
      instruction: {
        instruction_type: 'initialize_platform',
        programId: SOLANA_PROGRAM_ID,
        accounts: {
          platformConfig: platformPda.toBase58(),
          feeVault: '', // Will be derived
        },
        note: 'Try each discriminator format to find which one the deployed program expects',
      },
    });
  } catch (error) {
    console.error('debugDiscriminator error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});