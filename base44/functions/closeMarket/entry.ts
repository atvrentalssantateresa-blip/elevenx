import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { Connection, PublicKey, SystemProgram, TransactionInstruction } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'node:buffer';
import { sha256 } from 'npm:@noble/hashes@1.4.0/sha256';

const SOLANA_PROGRAM_ID = Deno.env.get('SOLANA_PROGRAM_ID') || '4epUYJPwoPhG9RPoQ6qT9dsAewJCDBSCGUpR1Xj9UxTm';
const SOLANA_RPC_URL = 'https://api.devnet.solana.com';

/**
 * Close an existing market account and refund SOL to admin
 * Use this before recreating a market with updated parameters
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    const payload = await req.json();
    const { bet_id, match_id, admin_wallet } = payload;

    if (!match_id) {
      return Response.json({ error: 'Missing match_id' }, { status: 400 });
    }

    if (!admin_wallet) {
      return Response.json({ error: 'Admin wallet address required' }, { status: 400 });
    }

    const programId = new PublicKey(SOLANA_PROGRAM_ID);
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
    
    // Derive market PDA
    const matchIdBytes = Buffer.alloc(32);
    Buffer.from(match_id, 'utf-8').copy(matchIdBytes, 0, 0, Math.min(match_id.length, 32));
    
    const [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('market'), matchIdBytes],
      programId
    );

    // Check if market exists
    const marketAccountInfo = await connection.getAccountInfo(marketPda);
    if (!marketAccountInfo) {
      return Response.json({ 
        error: 'Market does not exist',
        marketPda: marketPda.toBase58(),
        message: 'No market to close'
      });
    }

    // Get balance to refund
    const balanceLamports = marketAccountInfo.lamports;
    const balanceSol = balanceLamports / 1e9;

    console.log(`Market exists at ${marketPda.toBase58()} with ${balanceSol} SOL`);

    // Create close_account instruction
    // Anchor's close_account uses AccountClose trait - sends lamports to specified address
    const discriminator = Buffer.from(sha256("global:close_market")).slice(0, 8);
    
    const adminPubkey = new PublicKey(admin_wallet);
    
    const keys = [
      { pubkey: marketPda, isSigner: false, isWritable: true },
      { pubkey: adminPubkey, isSigner: false, isWritable: true }, // receives SOL
      { pubkey: adminPubkey, isSigner: true, isWritable: false }, // admin signer
    ];

    const instructionData = Buffer.concat([discriminator]);

    const closeIx = new TransactionInstruction({
      keys,
      programId,
      data: instructionData,
    });

    // Check if program supports close_market (it might not)
    // If not, we'll need to use system program to close the account
    
    return Response.json({
      success: true,
      message: `Close market instruction ready - will refund ${balanceSol} SOL to admin`,
      marketPda: marketPda.toBase58(),
      balanceLamports,
      balanceSol,
      admin_wallet,
      solana_instruction: {
        instruction_type: 'close_market',
        programId: SOLANA_PROGRAM_ID,
        instruction_data: instructionData.toString('base64'),
        accounts: {
          market: marketPda.toBase58(),
          admin: admin_wallet,
        }
      },
      warning: 'This will close the market and refund all SOL. Only do this if you want to recreate the market.',
    });

  } catch (error) {
    console.error('closeMarket error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});