import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { Connection, PublicKey } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'node:buffer';
import { sha256 } from 'npm:@noble/hashes@1.4.0/sha256';

function getSolanaConfig() {
  const rpcUrl = Deno.env.get('SOLANA_RPC_URL');
  const programIdStr = Deno.env.get('ELEVENX_PROGRAM_ID');
  if (!rpcUrl) throw new Error('SOLANA_RPC_URL secret not set');
  if (!programIdStr) throw new Error('ELEVENX_PROGRAM_ID secret not set');
  return { rpcUrl, programIdStr, programId: new PublicKey(programIdStr), connection: new Connection(rpcUrl, 'confirmed') };
}

/**
 * Admin-only: Sweep SOL from a settled/voided market account to fee vault.
 * sweep_market_funds — discriminator computed from global:sweep_market_funds
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { rpcUrl, programIdStr, programId, connection } = getSolanaConfig();

    const { market_pda, admin_wallet } = await req.json();
    if (!market_pda || !admin_wallet) {
      return Response.json({ error: 'Missing market_pda or admin_wallet' }, { status: 400 });
    }

    const marketPubkey = new PublicKey(market_pda);
    const marketInfo = await connection.getAccountInfo(marketPubkey);
    if (!marketInfo) return Response.json({ error: 'Market account not found on-chain' }, { status: 404 });

    // Use market's actual owner (handles cross-version deployments)
    const ownerProgramId = marketInfo.owner;
    console.log('[sweepMarketFunds] Market owner programId:', ownerProgramId.toBase58());
    console.log('[sweepMarketFunds] ELEVENX_PROGRAM_ID:', programIdStr);

    const balance = await connection.getBalance(marketPubkey);

    // Parse settled/voided state from market data
    const marketData = marketInfo.data;
    const isSettled = marketData.length >= 278 && marketData[276] === 1;
    const isVoided  = marketData.length >= 278 && marketData[277] === 1;
    if (!isSettled && !isVoided) {
      return Response.json({ error: 'Market must be settled or voided before sweeping', isSettled, isVoided }, { status: 400 });
    }

    const [platformPda] = PublicKey.findProgramAddressSync([Buffer.from('platform')], ownerProgramId);

    const discriminator = Buffer.from(sha256('global:sweep_market_funds')).slice(0, 8);
    const data = Buffer.from(discriminator);

    console.log('[sweepMarketFunds] rpcUrl:', rpcUrl);
    console.log('[sweepMarketFunds] Discriminator (hex):', discriminator.toString('hex'));

    const keys = [
      { pubkey: marketPubkey.toBase58(), isSigner: false, isWritable: true },
      { pubkey: platformPda.toBase58(), isSigner: false, isWritable: false },
      { pubkey: admin_wallet, isSigner: true, isWritable: true },
      { pubkey: admin_wallet, isSigner: false, isWritable: true },
      { pubkey: '11111111111111111111111111111111', isSigner: false, isWritable: false },
    ];
    console.log('[sweepMarketFunds] Accounts:', keys.map((k, i) => `[${i}] ${k.pubkey}`));

    return Response.json({
      success: true,
      message: `Sign to sweep ${balance / 1e9} SOL from market account`,
      balance: { lamports: balance, sol: balance / 1e9 },
      solana_instruction: {
        instruction_type: 'sweep_market_funds',
        programId: ownerProgramId.toBase58(),
        instruction_data: data.toString('base64'),
        keys,
      },
    });
  } catch (error) {
    console.error('[sweepMarketFunds] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});