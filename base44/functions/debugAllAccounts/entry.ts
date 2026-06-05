import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { PublicKey, Connection } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'node:buffer';

const SOLANA_PROGRAM_ID = Deno.env.get('SOLANA__PROGRAM_ID') || 'PMut1111111111111111111111111111111111111111';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const serviceRole = base44.asServiceRole;
    
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const programId = new PublicKey(SOLANA_PROGRAM_ID);
    
    // Get platform config
    const [platformPda] = PublicKey.findProgramAddressSync([Buffer.from('platform')], programId);
    const [feeVaultPda] = PublicKey.findProgramAddressSync([Buffer.from('fee_vault')], programId);
    
    const platformInfo = await connection.getAccountInfo(platformPda);
    const feeVaultInfo = await connection.getAccountInfo(feeVaultPda);
    
    console.log('=== PLATFORM CONFIG ===');
    console.log('PDA:', platformPda.toBase58());
    console.log('Exists:', !!platformInfo);
    if (platformInfo) {
      console.log('Size:', platformInfo.data.length);
      console.log('Discriminator (hex):', platformInfo.data.slice(0, 8).toString('hex'));
      console.log('Admin:', new PublicKey(platformInfo.data.slice(8, 40)).toBase58());
    }
    
    console.log('\n=== FEE VAULT ===');
    console.log('PDA:', feeVaultPda.toBase58());
    console.log('Exists:', !!feeVaultInfo);
    if (feeVaultInfo) {
      console.log('Size:', feeVaultInfo.data.length);
      console.log('Discriminator (hex):', feeVaultInfo.data.slice(0, 8).toString('hex'));
      console.log('Total fees:', feeVaultInfo.data.length >= 16 ? feeVaultInfo.data.readBigUInt64LE(8).toString() : 'N/A');
    } else {
      console.log('ERROR: Fee vault does not exist!');
    }
    
    // Get a market to check
    const bets = await serviceRole.entities.Bet.list();
    if (bets.length > 0 && bets[0].solana_market_pda) {
      const marketPda = new PublicKey(bets[0].solana_market_pda);
      const marketInfo = await connection.getAccountInfo(marketPda);
      
      console.log('\n=== MARKET (first bet) ===');
      console.log('PDA:', marketPda.toBase58());
      console.log('Exists:', !!marketInfo);
      if (marketInfo) {
        console.log('Size:', marketInfo.data.length);
        console.log('Discriminator (hex):', marketInfo.data.slice(0, 8).toString('hex'));
      }
    }
    
    return Response.json({
      platform: {
        exists: !!platformInfo,
        discriminator: platformInfo ? platformInfo.data.slice(0, 8).toString('hex') : null,
      },
      feeVault: {
        exists: !!feeVaultInfo,
        discriminator: feeVaultInfo ? feeVaultInfo.data.slice(0, 8).toString('hex') : null,
      },
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});