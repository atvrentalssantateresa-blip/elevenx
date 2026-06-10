import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { Connection, PublicKey } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'node:buffer';

function getSolanaConfig() {
  const rpcUrl = Deno.env.get('SOLANA_RPC_URL');
  const programIdStr = Deno.env.get('ELEVENX_PROGRAM_ID');
  if (!rpcUrl) throw new Error('SOLANA_RPC_URL secret not set');
  if (!programIdStr) throw new Error('ELEVENX_PROGRAM_ID secret not set');
  return { rpcUrl, programIdStr, programId: new PublicKey(programIdStr), connection: new Connection(rpcUrl, 'confirmed') };
}

/**
 * withdraw_fees instruction builder
 * Discriminator: [198, 212, 171, 109, 144, 215, 174, 89]
 * Data: discriminator + amount (u64 LE)
 * Accounts: fee_vault, platform_config, admin, system_program
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { programIdStr, programId, connection } = getSolanaConfig();

    const { amount_lamports, admin_wallet } = await req.json();
    if (!amount_lamports || amount_lamports <= 0) {
      return Response.json({ error: 'amount_lamports must be > 0' }, { status: 400 });
    }
    if (!admin_wallet) return Response.json({ error: 'admin_wallet required' }, { status: 400 });

    const [feeVaultPda] = PublicKey.findProgramAddressSync([Buffer.from('fee_vault')], programId);
    const [platformPda] = PublicKey.findProgramAddressSync([Buffer.from('platform')], programId);

    const feeVaultInfo = await connection.getAccountInfo(feeVaultPda);
    if (!feeVaultInfo) return Response.json({ error: 'Fee vault not found on-chain' }, { status: 400 });
    if (amount_lamports > feeVaultInfo.lamports) {
      return Response.json({ error: 'Insufficient funds in fee vault', requested: amount_lamports, available: feeVaultInfo.lamports }, { status: 400 });
    }

    const discriminator = Buffer.from([198, 212, 171, 109, 144, 215, 174, 89]);
    const instructionData = Buffer.alloc(16);
    discriminator.copy(instructionData, 0);
    instructionData.writeBigUInt64LE(BigInt(amount_lamports), 8);

    console.log('[withdrawFees] programId:', programIdStr);
    console.log('[withdrawFees] Discriminator (hex):', discriminator.toString('hex'));
    console.log('[withdrawFees] Amount (lamports):', amount_lamports);

    // Accounts: fee_vault, platform_config [readonly], admin [signer], system_program
    const keys = [
      { pubkey: feeVaultPda.toBase58(), isSigner: false, isWritable: true },
      { pubkey: platformPda.toBase58(), isSigner: false, isWritable: false },
      { pubkey: admin_wallet, isSigner: true, isWritable: true },
      { pubkey: '11111111111111111111111111111111', isSigner: false, isWritable: false },
    ];
    console.log('[withdrawFees] Accounts:', keys.map((k, i) => `[${i}] ${k.pubkey}`));

    return Response.json({
      success: true, amount_lamports, amount_sol: amount_lamports / 1e9,
      solana_instruction: {
        instruction_type: 'withdraw_fees',
        programId: programIdStr,
        keys,
        instruction_data: instructionData.toString('base64'),
      },
    });
  } catch (error) {
    console.error('[withdrawFees] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});