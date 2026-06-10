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
 * Settle a market on-chain — test_announce_winner instruction
 * Discriminator: [23, 224, 211, 209, 146, 125, 80, 245]
 * Data: discriminator + outcome (u8)
 * Accounts: market, fee_vault, platform_config, admin, system_program
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const serviceRole = base44.asServiceRole;
    const { rpcUrl, programIdStr, programId, connection } = getSolanaConfig();

    const { bet_id, winning_outcome, admin_wallet } = await req.json();
    if (!bet_id || !winning_outcome || !['a', 'b', 'draw'].includes(winning_outcome)) {
      return Response.json({ error: 'Invalid parameters' }, { status: 400 });
    }
    if (!admin_wallet) return Response.json({ error: 'Admin wallet address required' }, { status: 400 });

    const bet = await serviceRole.entities.Bet.get(bet_id);
    if (!bet) return Response.json({ error: 'Bet not found' }, { status: 404 });

    const matchIdBytes = Buffer.alloc(32);
    Buffer.from(bet.match_id, 'utf-8').copy(matchIdBytes, 0, 0, Math.min(bet.match_id.length, 32));

    const [marketPda] = PublicKey.findProgramAddressSync([Buffer.from('market'), matchIdBytes], programId);
    const [platformPda] = PublicKey.findProgramAddressSync([Buffer.from('platform')], programId);
    const [feeVaultPda] = PublicKey.findProgramAddressSync([Buffer.from('fee_vault')], programId);

    const platformInfo = await connection.getAccountInfo(platformPda);
    if (!platformInfo) return Response.json({ error: 'Platform config not found on-chain' }, { status: 400 });

    const feeVaultInfo = await connection.getAccountInfo(feeVaultPda);
    if (!feeVaultInfo) return Response.json({ error: 'Fee vault not found on-chain' }, { status: 400 });

    const discriminator = Buffer.from([23, 224, 211, 209, 146, 125, 80, 245]);
    const outcomeIndex = winning_outcome === 'a' ? 0 : winning_outcome === 'b' ? 1 : 2;
    const instructionData = Buffer.alloc(9);
    discriminator.copy(instructionData, 0);
    instructionData.writeUInt8(outcomeIndex, 8);

    console.log('[settleMarketOnChain] programId:', programIdStr, 'rpcUrl:', rpcUrl);
    console.log('[settleMarketOnChain] Discriminator (hex):', discriminator.toString('hex'));
    console.log('[settleMarketOnChain] Outcome:', winning_outcome, '-> index:', outcomeIndex);

    // Accounts: market, fee_vault, platform_config [readonly], admin [signer], system_program
    const keys = [
      { pubkey: marketPda.toBase58(), isSigner: false, isWritable: true },
      { pubkey: feeVaultPda.toBase58(), isSigner: false, isWritable: true },
      { pubkey: platformPda.toBase58(), isSigner: false, isWritable: false },
      { pubkey: admin_wallet, isSigner: true, isWritable: true },
      { pubkey: '11111111111111111111111111111111', isSigner: false, isWritable: false },
    ];
    console.log('[settleMarketOnChain] Accounts:', keys.map((k, i) => `[${i}] ${k.pubkey}`));

    const outcomeLabel = winning_outcome === 'a' ? bet.outcome_a : winning_outcome === 'b' ? bet.outcome_b : 'Draw';
    return Response.json({
      success: true, bet_id, winning_outcome,
      message: `Sign to settle market: ${outcomeLabel}`,
      solana_instruction: {
        instruction_type: 'settle_market',
        programId: programIdStr,
        keys,
        instruction_data: instructionData.toString('base64'),
      },
    });
  } catch (error) {
    console.error('[settleMarketOnChain] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});