import { Connection, PublicKey } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'node:buffer';

/**
 * Server-side Solana RPC proxy.
 * Supported actions:
 *   getLatestBlockhash  → { blockhash, lastValidBlockHeight }
 *   getSignatureStatus  → { status }  (params: { signature })
 *   getAccountInfo      → { exists, data_b64, lamports, owner } (params: { pubkey })
 */
Deno.serve(async (req) => {
  try {
    const rpcUrl = Deno.env.get('SOLANA_RPC_URL');
    if (!rpcUrl) return Response.json({ error: 'SOLANA_RPC_URL not set' }, { status: 500 });

    const { action, params = {} } = await req.json();
    const connection = new Connection(rpcUrl, 'confirmed');

    if (action === 'getLatestBlockhash') {
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      return Response.json({ blockhash, lastValidBlockHeight });
    }

    if (action === 'confirmTransaction') {
      const { signature, blockhash, lastValidBlockHeight } = params;
      if (!signature) return Response.json({ error: 'Missing signature' }, { status: 400 });
      const result = await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        'confirmed'
      );
      return Response.json({ err: result.value?.err || null });
    }

    if (action === 'getSignatureStatus') {
      const { signature } = params;
      if (!signature) return Response.json({ error: 'Missing signature' }, { status: 400 });
      const result = await connection.getSignatureStatus(signature, { searchTransactionHistory: true });
      return Response.json({ status: result.value });
    }

    if (action === 'getAccountInfo') {
      const { pubkey } = params;
      if (!pubkey) return Response.json({ error: 'Missing pubkey' }, { status: 400 });
      const info = await connection.getAccountInfo(new PublicKey(pubkey));
      if (!info) return Response.json({ exists: false });
      return Response.json({
        exists: true,
        lamports: info.lamports,
        owner: info.owner.toBase58(),
        data_b64: Buffer.from(info.data).toString('base64'),
        dataLength: info.data.length,
      });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    console.error('[solanaRpc] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});