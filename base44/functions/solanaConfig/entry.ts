import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Returns current Solana configuration from env secrets.
 * Admin-only diagnostic endpoint.
 */
Deno.serve(async (req) => {
  try {
    const rpcUrl = Deno.env.get('SOLANA_RPC_URL');
    const programId = Deno.env.get('ELEVENX_PROGRAM_ID');
    // Legacy fallback read (informational only)
    const legacyProgramId = Deno.env.get('SOLANA_PROGRAM_ID');

    if (!rpcUrl) return Response.json({ error: 'SOLANA_RPC_URL secret not set' }, { status: 400 });
    if (!programId) return Response.json({ error: 'ELEVENX_PROGRAM_ID secret not set' }, { status: 400 });

    return Response.json({
      rpcUrl,
      programId,
      network: rpcUrl.includes('mainnet') ? 'mainnet-beta' : rpcUrl.includes('devnet') ? 'devnet' : 'custom',
      legacyProgramId: legacyProgramId || '(not set)',
      message: 'Solana configuration loaded from secrets',
    });
  } catch (error) {
    console.error('solanaConfig error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});