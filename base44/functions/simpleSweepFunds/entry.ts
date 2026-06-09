import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { PublicKey, Connection, SystemProgram, Transaction } from 'npm:@solana/web3.js@1.98.4';

/**
 * Simple sweep - just transfer all SOL from market to admin.
 * No program interaction needed - pure SOL transfer.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const payload = await req.json();
    const marketPda = payload.market_pda;
    const adminWallet = payload.admin_wallet;

    if (!marketPda || !adminWallet) {
      return Response.json({ 
        error: 'Missing market_pda or admin_wallet',
        received: payload 
      }, { status: 400 });
    }

    const marketPubkey = new PublicKey(marketPda);
    const adminPubkey = new PublicKey(adminWallet);

    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const balance = await connection.getBalance(marketPubkey);
    
    if (balance === 0) {
      return Response.json({ error: 'Market account has 0 SOL' }, { status: 400 });
    }

    // Keep rent-exempt minimum (0.002 SOL approx)
    const rentExempt = await connection.getMinimumBalanceForRentExemption(344); // Market account size
    const transferAmount = Math.max(0, balance - rentExempt);
    
    if (transferAmount === 0) {
      return Response.json({ 
        error: 'Not enough SOL to transfer after keeping rent-exempt minimum',
        balance,
        rentExempt,
      }, { status: 400 });
    }

    console.log('[simpleSweepFunds] Preparing sweep:', {
      marketPda: marketPubkey.toBase58(),
      adminWallet: adminPubkey.toBase58(),
      balanceLamports: balance,
      balanceSOL: balance / 1e9,
      transferAmount,
      transferSOL: transferAmount / 1e9,
    });

    // Create a simple transfer instruction
    const transferInstruction = SystemProgram.transfer({
      fromPubkey: marketPubkey,
      toPubkey: adminPubkey,
      lamports: transferAmount,
    });

    // Serialize for frontend
    const transaction = new Transaction().add(transferInstruction);
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = adminPubkey;

    return Response.json({
      success: true,
      message: `Sign to sweep ◎${transferAmount / 1e9} SOL from market to your wallet`,
      balance: {
        lamports: balance,
        sol: balance / 1e9,
      },
      transfer: {
        lamports: transferAmount,
        sol: transferAmount / 1e9,
      },
      solana_instruction: {
        instruction_type: 'simple_sweep',
        programId: SystemProgram.programId.toBase58(),
        instruction_data: transferInstruction.data.toString('base64'),
        keys: [
          { pubkey: marketPubkey.toBase58(), isSigner: false, isWritable: true },
          { pubkey: adminPubkey.toBase58(), isSigner: false, isWritable: true },
        ]
      }
    });
  } catch (error) {
    console.error('[simpleSweepFunds] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});