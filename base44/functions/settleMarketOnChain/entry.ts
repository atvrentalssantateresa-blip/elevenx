import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { Connection, PublicKey } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'node:buffer';

const ORACLE_PUBKEY = 'TANKr3X5h45271pGw2GxGoaeHXZRBXHwr1AAvcAop2G';
const ED25519_PROGRAM = 'Ed25519SigVerify111111111111111111111111111111';
const INSTRUCTIONS_SYSVAR = 'Sysvar1nstructions1111111111111111111111111111';

async function anchorDiscriminator(name) {
  const msg = new TextEncoder().encode(`global:${name}`);
  const hash = await crypto.subtle.digest('SHA-256', msg);
  return Buffer.from(new Uint8Array(hash).slice(0, 8));
}

function getSolanaConfig() {
  const rpcUrl = Deno.env.get('SOLANA_RPC_URL');
  const programIdStr = Deno.env.get('ELEVENX_PROGRAM_ID');
  if (!rpcUrl) throw new Error('SOLANA_RPC_URL secret not set');
  if (!programIdStr) throw new Error('ELEVENX_PROGRAM_ID secret not set');
  return { rpcUrl, programIdStr, programId: new PublicKey(programIdStr), connection: new Connection(rpcUrl, 'confirmed') };
}

/**
 * Build the Ed25519SigVerify instruction data.
 * Layout (Solana native Ed25519 program):
 *   [0]     num_signatures (u8) = 1
 *   [1]     padding (u8) = 0
 *   [2..3]  signature_offset (u16 LE) — offset of sig bytes within this buffer
 *   [4..5]  signature_instruction_index (u16 LE) = 0xFFFF (this instruction)
 *   [6..7]  public_key_offset (u16 LE)
 *   [8..9]  public_key_instruction_index (u16 LE) = 0xFFFF
 *   [10..11] message_data_offset (u16 LE)
 *   [12..13] message_data_size (u16 LE)
 *   [14..15] message_instruction_index (u16 LE) = 0xFFFF
 *   [16..79]  signature (64 bytes)
 *   [80..111] public key (32 bytes)
 *   [112..144] message (33 bytes: 32 market pubkey + 1 outcome)
 */
function buildEd25519InstructionData(signatureBytes, pubkeyBytes, messageBytes) {
  const HEADER_SIZE = 16;
  const SIG_SIZE = 64;
  const PUBKEY_SIZE = 32;

  const sigOffset = HEADER_SIZE;
  const pubkeyOffset = sigOffset + SIG_SIZE;
  const msgOffset = pubkeyOffset + PUBKEY_SIZE;
  const msgSize = messageBytes.length;

  const data = Buffer.alloc(msgOffset + msgSize);
  data.writeUInt8(1, 0);          // num_signatures
  data.writeUInt8(0, 1);          // padding
  data.writeUInt16LE(sigOffset, 2);
  data.writeUInt16LE(0xffff, 4);  // sig instruction index = this ix
  data.writeUInt16LE(pubkeyOffset, 6);
  data.writeUInt16LE(0xffff, 8);  // pubkey instruction index = this ix
  data.writeUInt16LE(msgOffset, 10);
  data.writeUInt16LE(msgSize, 12);
  data.writeUInt16LE(0xffff, 14); // message instruction index = this ix

  signatureBytes.copy(data, sigOffset);
  pubkeyBytes.copy(data, pubkeyOffset);
  messageBytes.copy(data, msgOffset);

  return data;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const serviceRole = base44.asServiceRole;
    const { rpcUrl, programIdStr, programId, connection } = getSolanaConfig();

    const { bet_id, winning_outcome, admin_wallet, oracle_signature } = await req.json();

    const validOutcomes = ['a', 'b', 'draw', 'void'];
    if (!bet_id || !winning_outcome || !validOutcomes.includes(winning_outcome)) {
      return Response.json({ error: 'Invalid parameters. winning_outcome must be a|b|draw|void' }, { status: 400 });
    }
    if (!admin_wallet) return Response.json({ error: 'Admin wallet address required' }, { status: 400 });
    if (winning_outcome !== 'void' && !oracle_signature) {
      return Response.json({ error: 'oracle_signature required' }, { status: 400 });
    }

    const bet = await serviceRole.entities.Bet.get(bet_id);
    if (!bet) return Response.json({ error: 'Bet not found' }, { status: 404 });

    const matchIdBytes = Buffer.alloc(32);
    Buffer.from(bet.match_id, 'utf-8').copy(matchIdBytes, 0, 0, Math.min(bet.match_id.length, 32));

    const [marketPda] = PublicKey.findProgramAddressSync([Buffer.from('market'), matchIdBytes], programId);
    const [platformPda] = PublicKey.findProgramAddressSync([Buffer.from('platform')], programId);
    const [feeVaultPda] = PublicKey.findProgramAddressSync([Buffer.from('fee_vault')], programId);

    const platformInfo = await connection.getAccountInfo(platformPda);
    if (!platformInfo) return Response.json({ error: 'Platform config not found on-chain' }, { status: 400 });

    // ── VOID path: single force_void_market instruction ───────────────────────
    if (winning_outcome === 'void') {
      const disc = await anchorDiscriminator('force_void_market');
      const keys = [
        { pubkey: marketPda.toBase58(), isSigner: false, isWritable: true },
        { pubkey: platformPda.toBase58(), isSigner: false, isWritable: false },
        { pubkey: 'SIGNER_WALLET', isSigner: true, isWritable: false },
        { pubkey: '11111111111111111111111111111111', isSigner: false, isWritable: false },
      ];
      return Response.json({
        success: true, bet_id, winning_outcome: 'void',
        message: 'Sign to void market (force_void_market)',
        solana_instruction: {
          instruction_type: 'settle_market',
          programId: programIdStr,
          rpcUrl,
          keys,
          instruction_data: disc.toString('base64'),
        },
      });
    }

    // ── SETTLE path: 2-instruction transaction ────────────────────────────────
    const outcomeMap = { a: 0, b: 1, draw: 2 };
    const outcomeU8 = outcomeMap[winning_outcome];

    // Decode oracle signature (base64, 64 bytes)
    let signatureBytes;
    try {
      signatureBytes = Buffer.from(oracle_signature, 'base64');
      if (signatureBytes.length !== 64) throw new Error('bad length');
    } catch (_) {
      return Response.json({ error: 'oracle_signature must be base64-encoded 64-byte Ed25519 signature' }, { status: 400 });
    }

    // Oracle pubkey bytes (32 bytes)
    const oraclePubkeyBytes = Buffer.from(new PublicKey(ORACLE_PUBKEY).toBytes());

    // Message: market_pubkey(32) || outcome(1)
    const messageBytes = Buffer.alloc(33);
    Buffer.from(marketPda.toBytes()).copy(messageBytes, 0);
    messageBytes.writeUInt8(outcomeU8, 32);

    // ── Instruction 0: Ed25519SigVerify ──────────────────────────────────────
    const ed25519Data = buildEd25519InstructionData(signatureBytes, oraclePubkeyBytes, messageBytes);
    const ix0 = {
      programId: ED25519_PROGRAM,
      keys: [],  // Ed25519 program takes no accounts
      instruction_data: ed25519Data.toString('base64'),
    };

    // ── Instruction 1: settle_with_attestation ────────────────────────────────
    const disc = await anchorDiscriminator('settle_with_attestation');
    const settleData = Buffer.alloc(9);
    disc.copy(settleData, 0);
    settleData.writeUInt8(outcomeU8, 8);

    const ix1 = {
      programId: programIdStr,
      keys: [
        { pubkey: marketPda.toBase58(), isSigner: false, isWritable: true },
        { pubkey: feeVaultPda.toBase58(), isSigner: false, isWritable: true },
        { pubkey: INSTRUCTIONS_SYSVAR, isSigner: false, isWritable: false },
        { pubkey: '11111111111111111111111111111111', isSigner: false, isWritable: false },
      ],
      instruction_data: settleData.toString('base64'),
    };

    const outcomeLabel = winning_outcome === 'a' ? bet.outcome_a : winning_outcome === 'b' ? bet.outcome_b : 'Draw';
    return Response.json({
      success: true, bet_id, winning_outcome,
      message: `Sign to settle: ${outcomeLabel} wins (settle_with_attestation, outcome=${outcomeU8})`,
      solana_instruction: {
        instruction_type: 'settle_market',
        programId: programIdStr,
        rpcUrl,
        // Two instructions in a single transaction
        instructions: [ix0, ix1],
        // Backwards-compatible single-ix fields (ignored when instructions[] present)
        keys: ix1.keys,
        instruction_data: settleData.toString('base64'),
      },
    });

  } catch (error) {
    console.error('[settleMarketOnChain] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});