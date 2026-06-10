import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { Connection, PublicKey } from 'npm:@solana/web3.js@1.98.4';

/**
 * Shared Solana configuration helper.
 * Returns { rpcUrl, programIdStr, programId, connection } read from env vars:
 *   SOLANA_RPC_URL      — e.g. https://api.devnet.solana.com
 *   ELEVENX_PROGRAM_ID  — e.g. EQiqoL7VX5n4BTxuHwyWBa1bmYvTSeWRWBdSCyyFxHvN
 *
 * All other backend functions should invoke this to get the Connection and programId
 * instead of hardcoding either value.
 */
Deno.serve(async (req) => {
  try {
    const rpcUrl = Deno.env.get('SOLANA_RPC_URL');
    const programIdStr = Deno.env.get('ELEVENX_PROGRAM_ID');

    if (!rpcUrl) {
      return Response.json({ error: 'SOLANA_RPC_URL secret not set' }, { status: 500 });
    }
    if (!programIdStr) {
      return Response.json({ error: 'ELEVENX_PROGRAM_ID secret not set' }, { status: 500 });
    }

    const connection = new Connection(rpcUrl, 'confirmed');
    const programId = new PublicKey(programIdStr);

    return Response.json({
      rpcUrl,
      programIdStr,
      network: rpcUrl.includes('mainnet') ? 'mainnet-beta' : rpcUrl.includes('devnet') ? 'devnet' : 'custom',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Helper used by OTHER backend functions (not via HTTP invoke).
 * Call getSolanaConfig() inside Deno.serve handlers to get typed config.
 */
export function getSolanaConfig() {
  const rpcUrl = Deno.env.get('SOLANA_RPC_URL');
  const programIdStr = Deno.env.get('ELEVENX_PROGRAM_ID');

  if (!rpcUrl) throw new Error('SOLANA_RPC_URL secret not set');
  if (!programIdStr) throw new Error('ELEVENX_PROGRAM_ID secret not set');

  return {
    rpcUrl,
    programIdStr,
    programId: new PublicKey(programIdStr),
    connection: new Connection(rpcUrl, 'confirmed'),
  };
}