import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { PublicKey } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'node:buffer';

const ORACLE_PUBKEY = 'TANKr3X5h45271pGw2GxGoaeHXZRBXHwr1AAvcAop2G';
const ED25519_PROGRAM = 'Ed25519SigVerify111111111111111111111111111111';
const INSTRUCTIONS_SYSVAR = 'Sysvar1nstructions1111111111111111111111111111';
const SYSTEM_PROGRAM = '11111111111111111111111111111111';

async function anchorDiscriminator(name) {
  const msg = new TextEncoder().encode(`global:${name}`);
  const hash = await crypto.subtle.digest('SHA-256', msg);
  return Buffer.from(new Uint8Array(hash).slice(0, 8));
}

/**
 * Build Ed25519SigVerify instruction data.
 * Header (16 bytes) + signature (64) + pubkey (32) + message (33)
 */
function buildEd25519InstructionData(signatureBytes, pubkeyBytes, messageBytes) {
  const HEADER_SIZE = 16;
  const sigOffset    = HEADER_SIZE;
  const pubkeyOffset = sigOffset + 64;
  const msgOffset    = pubkeyOffset + 32;
  const msgSize      = messageBytes.length;

  const data = Buffer.alloc(msgOffset + msgSize);
  data.writeUInt8(1, 0);            // num_signatures
  data.writeUInt8(0, 1);            // padding
  data.writeUInt16LE(sigOffset, 2);
  data.writeUInt16LE(0xffff, 4);    // sig_instruction_index = this ix
  data.writeUInt16LE(pubkeyOffset, 6);
  data.writeUInt16LE(0xffff, 8);    // pubkey_instruction_index = this ix
  data.writeUInt16LE(msgOffset, 10);
  data.writeUInt16LE(msgSize, 12);
  data.writeUInt16LE(0xffff, 14);   // message_instruction_index = this ix
  signatureBytes.copy(data, sigOffset);
  pubkeyBytes.copy(data, pubkeyOffset);
  messageBytes.copy(data, msgOffset);
  return data;
}

Deno.serve(async (req) => {
  try {
    const programIdStr = Deno.env.get('ELEVENX_PROGRAM_ID');
    const rpcUrl       = Deno.env.get('SOLANA_RPC_URL');
    if (!programIdStr) throw new Error('ELEVENX_PROGRAM_ID secret not set');
    if (!rpcUrl)       throw new Error('SOLANA_RPC_URL secret not set');

    const programId = new PublicKey(programIdStr);

    const { market_pda, winning_outcome, admin_wallet, oracle_signature } = await req.json();

    // Validate inputs
    const validOutcomes = ['a', 'b', 'draw', 'void'];
    if (!market_pda)     return Response.json({ error: 'market_pda required' }, { status: 400 });
    if (!admin_wallet)   return Response.json({ error: 'admin_wallet required' }, { status: 400 });
    if (!winning_outcome || !validOutcomes.includes(winning_outcome)) {
      return Response.json({ error: 'winning_outcome must be a|b|draw|void' }, { status: 400 });
    }
    if (winning_outcome !== 'void' && !oracle_signature) {
      return Response.json({ error: 'oracle_signature required' }, { status: 400 });
    }

    // Outcome mapping: a→0, b→1, draw→2
    const outcomeMap = { a: 0, b: 1, draw: 2 };

    const marketPubkey = new PublicKey(market_pda);
    const [platformPda] = PublicKey.findProgramAddressSync([Buffer.from('platform')], programId);
    const [feeVaultPda] = PublicKey.findProgramAddressSync([Buffer.from('fee_vault')], programId);

    // ── VOID path: single force_void_market instruction ───────────────────────
    if (winning_outcome === 'void') {
      const disc = await anchorDiscriminator('force_void_market');
      return Response.json({
        success: true,
        winning_outcome: 'void',
        message: 'Sign to void market (force_void_market)',
        solana_instruction: {
          instruction_type: 'settle_market',
          programId: programIdStr,
          rpcUrl,
          keys: [
            { pubkey: market_pda,                    isSigner: false, isWritable: true  },
            { pubkey: platformPda.toBase58(),         isSigner: false, isWritable: false },
            { pubkey: 'SIGNER_WALLET',               isSigner: true,  isWritable: false },
            { pubkey: SYSTEM_PROGRAM,                isSigner: false, isWritable: false },
          ],
          instruction_data: disc.toString('base64'),
        },
      });
    }

    // ── SETTLE path: 2-instruction transaction ────────────────────────────────
    const outcomeU8 = outcomeMap[winning_outcome];

    // Decode + validate oracle signature
    let signatureBytes;
    try {
      signatureBytes = Buffer.from(oracle_signature, 'base64');
      if (signatureBytes.length !== 64) throw new Error('wrong length');
    } catch (_) {
      return Response.json({ error: 'oracle_signature must be base64-encoded 64-byte Ed25519 signature' }, { status: 400 });
    }

    const oraclePubkeyBytes = Buffer.from(new PublicKey(ORACLE_PUBKEY).toBytes());

    // Message signed by oracle: market_pubkey(32) || outcome(1)
    const messageBytes = Buffer.alloc(33);
    Buffer.from(marketPubkey.toBytes()).copy(messageBytes, 0);
    messageBytes.writeUInt8(outcomeU8, 32);

    // Ix 0: Ed25519SigVerify (no accounts)
    const ed25519Data = buildEd25519InstructionData(signatureBytes, oraclePubkeyBytes, messageBytes);
    const ix0 = {
      programId: ED25519_PROGRAM,
      keys: [],
      instruction_data: ed25519Data.toString('base64'),
    };

    // Ix 1: settle_with_attestation — accounts: market(mut), fee_vault(mut), instructions_sysvar, system_program
    const disc = await anchorDiscriminator('settle_with_attestation');
    const settleData = Buffer.alloc(9);
    disc.copy(settleData, 0);
    settleData.writeUInt8(outcomeU8, 8);

    const ix1 = {
      programId: programIdStr,
      keys: [
        { pubkey: market_pda,                isSigner: false, isWritable: true  },
        { pubkey: feeVaultPda.toBase58(),     isSigner: false, isWritable: true  },
        { pubkey: INSTRUCTIONS_SYSVAR,       isSigner: false, isWritable: false },
        { pubkey: SYSTEM_PROGRAM,            isSigner: false, isWritable: false },
      ],
      instruction_data: settleData.toString('base64'),
    };

    return Response.json({
      success: true,
      winning_outcome,
      outcome_u8: outcomeU8,
      message: `Sign to settle market (settle_with_attestation, outcome=${outcomeU8})`,
      solana_instruction: {
        instruction_type: 'settle_market',
        programId: programIdStr,
        rpcUrl,
        instructions: [ix0, ix1],
      },
    });

  } catch (error) {
    console.error('[settleMarketOnChain] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});