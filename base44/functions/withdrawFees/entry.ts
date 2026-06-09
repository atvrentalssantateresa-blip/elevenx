import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { Connection, PublicKey, SystemProgram, TransactionInstruction } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'npm:buffer@6.0.3';

/**
 * Admin-only: Directly sweep stuck funds from a market account to admin wallet.
 * Uses a simple SOL transfer instead of program instruction (works with old deployments).
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const payload = await req.json();
    const { market_pda, admin_wallet } = payload;

    if (!market_pda || !admin_wallet) {
      return Response.json({ error: 'Missing market_pda or admin_wallet' }, { status: 400 });
    }

    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const marketPubkey = new PublicKey(market_pda);
    
    // Get market balance
    const balance = await connection.getBalance(marketPubkey);
    const rent = await connection.getMinimumBalanceForRentExemption(215); // Market account size
    
    // Calculate withdrawable amount (balance minus rent-exempt minimum)
    const withdrawableLamports = Math.max(0, balance - rent);
    
    if (withdrawableLamports <= 0) {
      return Response.json({ 
        error: 'No withdrawable funds (balance too low or at rent-exempt minimum)',
        balanceLamports: balance,
        rentExemptMinimum: rent,
      }, { status: 400 });
    }

    console.log('[withdrawFees] Market sweep:', {
      marketPda: market_pda,
      adminWallet: admin_wallet,
      balanceLamports: balance,
      rentExemptMinimum: rent,
      withdrawableLamports,
      withdrawableSOL: withdrawableLamports / 1e9,
    });

    // Create a simple SystemProgram transfer instruction
    const transferIx = SystemProgram.transfer({
      fromPubkey: marketPubkey,
      toPubkey: new PublicKey(admin_wallet),
      lamports: withdrawableLamports,
    });

    return Response.json({
      success: true,
      message: `Sign to sweep ◎${(withdrawableLamports / 1e9).toFixed(6)} SOL from market to your wallet`,
      solana_instruction: {
        instruction_type: 'sweep_market_funds_simple',
        programId: SystemProgram.programId.toBase58(),
        instruction_data: transferIx.data.toString('base64'),
        keys: [
          { pubkey: market_pda, isSigner: false, isWritable: true },
          { pubkey: admin_wallet, isSigner: false, isWritable: true },
        ]
      },
      balance: {
        lamports: balance,
        sol: balance / 1e9,
      },
      withdrawable: {
        lamports: withdrawableLamports,
        sol: withdrawableLamports / 1e9,
      },
    });
  } catch (error) {
    console.error('[withdrawFees] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});