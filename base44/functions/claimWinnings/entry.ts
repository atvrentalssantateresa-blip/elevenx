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
 * claim_winnings instruction builder
 * Discriminator: [161, 215, 24, 59, 14, 236, 242, 221]
 * Data: discriminator + 1 byte outcome (u8)
 * Accounts: market, bet_position, fee_vault, bettor, system_program
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const serviceRole = base44.asServiceRole;
    const { programIdStr, programId } = getSolanaConfig();

    const { userBetId, walletAddress } = await req.json();

    if (!walletAddress) {
      return Response.json({ error: 'Missing wallet address' }, { status: 400 });
    }

    const userBets = await serviceRole.entities.UserBet.filter({ id: userBetId });
    const userBet = userBets[0];
    if (!userBet) return Response.json({ error: 'UserBet not found' }, { status: 404 });

    const bets = await serviceRole.entities.Bet.filter({ id: userBet.bet_id });
    const bet = bets[0];
    if (!bet) return Response.json({ error: 'Bet entity not found' }, { status: 404 });

    const bettorPubkey = new PublicKey(walletAddress);
    const matchIdBytes = Buffer.alloc(32);
    Buffer.from(userBet.match_id, 'utf-8').copy(matchIdBytes, 0, 0, Math.min(userBet.match_id.length, 32));

    const [marketPda] = PublicKey.findProgramAddressSync([Buffer.from('market'), matchIdBytes], programId);
    const outcomeIndex = userBet.outcome === 'a' ? 0 : userBet.outcome === 'b' ? 1 : 2;
    const [positionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('position'), marketPda.toBuffer(), bettorPubkey.toBuffer(), Buffer.from([outcomeIndex])],
      programId
    );
    const [feeVaultPda] = PublicKey.findProgramAddressSync([Buffer.from('fee_vault')], programId);

    const discriminator = Buffer.from([161, 215, 24, 59, 14, 236, 242, 221]);
    const instructionData = Buffer.alloc(9);
    discriminator.copy(instructionData, 0);
    instructionData.writeUInt8(outcomeIndex, 8);

    console.log('[claimWinnings] programId:', programIdStr);
    console.log('[claimWinnings] Discriminator (hex):', discriminator.toString('hex'));

    // Accounts: market, bet_position, fee_vault, bettor [NOT signer], system_program
    const keys = [
      { pubkey: marketPda.toBase58(), isSigner: false, isWritable: true },
      { pubkey: positionPda.toBase58(), isSigner: false, isWritable: true },
      { pubkey: feeVaultPda.toBase58(), isSigner: false, isWritable: true },
      { pubkey: walletAddress, isSigner: false, isWritable: true },
      { pubkey: '11111111111111111111111111111111', isSigner: false, isWritable: false },
    ];
    console.log('[claimWinnings] Accounts:', keys.map((k, i) => `[${i}] ${k.pubkey}`));

    return Response.json({
      success: true,
      message: 'Ready to claim winnings',
      userBetId,
      solana_instruction: {
        instruction_type: 'claim_winnings',
        programId: programIdStr,
        keys,
        instruction_data: instructionData.toString('base64'),
      },
    });
  } catch (error) {
    console.error('[claimWinnings] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});