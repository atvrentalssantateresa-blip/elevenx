import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { PublicKey, Connection } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'node:buffer';

const SOLANA_PROGRAM_ID = Deno.env.get('SOLANA_PROGRAM_ID');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const programId = new PublicKey(SOLANA_PROGRAM_ID.trim());
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const adminPubkey = new PublicKey(user.wallet_address || user.email);

    // Derive PDAs
    const [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('market'), Buffer.from('test_match_1')],
      programId
    );

    const [voteTallyPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vote_tally'), Buffer.from('test_match_1')],
      programId
    );

    const [platformPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('platform')],
      programId
    );

    // Check if platform exists
    const platformAccount = await connection.getAccountInfo(platformPda);
    
    if (!platformAccount) {
      return Response.json({
        success: false,
        error: 'Platform not initialized',
        message: 'Initialize platform first before creating markets',
        platformPda: platformPda.toBase58(),
      });
    }

    // Parse platform to check admin
    const platformData = Buffer.from(platformAccount.data);
    const platformAdmin = new PublicKey(platformData.slice(8, 40)).toBase58();
    
    console.log('Platform admin:', platformAdmin);
    console.log('User wallet:', adminPubkey.toBase58());

    // Build create_market instruction
    // Discriminator: SHA256("global:create_market").slice(0, 8)
    const discBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('global:create_market'));
    const discriminator = Buffer.from(new Uint8Array(discBuffer).slice(0, 8));
    
    console.log('create_market discriminator:', discriminator.toString('hex'));

    // Build instruction data: 8-byte disc + CreateMarketParams (171 bytes)
    const paramsData = Buffer.alloc(171);
    let offset = 0;
    
    // match_id: Pubkey (32 bytes)
    Buffer.from('test_match_1').copy(paramsData, offset);
    offset += 32;
    
    // match_title: String (4-byte len + UTF-8 bytes, padded to 64)
    const title = 'Test Match: Team A vs Team B';
    paramsData.writeUInt32LE(title.length, offset);
    Buffer.from(title, 'utf-8').copy(paramsData, offset + 4);
    offset += 64;
    
    // team_a: String (4 + 32)
    const teamA = 'Team A';
    paramsData.writeUInt32LE(teamA.length, offset);
    Buffer.from(teamA, 'utf-8').copy(paramsData, offset + 4);
    offset += 32;
    
    // team_b: String (4 + 32)
    const teamB = 'Team B';
    paramsData.writeUInt32LE(teamB.length, offset);
    Buffer.from(teamB, 'utf-8').copy(paramsData, offset + 4);
    offset += 32;
    
    // outcome_a_label: String (4 + 16)
    const outcomeA = 'Team A';
    paramsData.writeUInt32LE(outcomeA.length, offset);
    Buffer.from(outcomeA, 'utf-8').copy(paramsData, offset + 4);
    offset += 16;
    
    // outcome_b_label: String (4 + 16)
    const outcomeB = 'Team B';
    paramsData.writeUInt32LE(outcomeB.length, offset);
    Buffer.from(outcomeB, 'utf-8').copy(paramsData, offset + 4);
    offset += 16;
    
    // outcome_draw_label: String (4 + 16)
    const outcomeDraw = 'Draw';
    paramsData.writeUInt32LE(outcomeDraw.length, offset);
    Buffer.from(outcomeDraw, 'utf-8').copy(paramsData, offset + 4);
    offset += 16;
    
    // open_until: i64 (8 bytes) - 24 hours from now
    const openUntil = BigInt(Date.now() + 86400000);
    paramsData.writeBigUInt64LE(openUntil, offset);
    offset += 8;
    
    // settle_after: i64 (8 bytes) - 48 hours from now
    const settleAfter = BigInt(Date.now() + 172800000);
    paramsData.writeBigUInt64LE(settleAfter, offset);
    offset += 8;
    
    // fee_percent: u16 (2 bytes)
    paramsData.writeUInt16LE(0, offset);
    offset += 2;
    
    // is_active: bool (1 byte)
    paramsData.writeUInt8(1, offset);
    offset += 1;
    
    // is_parimutuel: bool (1 byte)
    paramsData.writeUInt8(1, offset);
    offset += 1;

    const initData = Buffer.alloc(8 + 171);
    discriminator.copy(initData, 0);
    paramsData.copy(initData, 8);

    console.log('Instruction data length:', initData.length);
    console.log('Instruction data (hex):', initData.toString('hex'));

    const instruction = {
      instruction_type: 'create_market',
      programId: SOLANA_PROGRAM_ID,
      accounts: {
        market: marketPda.toBase58(),
        voteTally: voteTallyPda.toBase58(),
        platformConfig: platformPda.toBase58(),
        admin: adminPubkey.toBase58(),
      },
      instruction_data: initData.toString('base64'),
    };

    return Response.json({
      success: true,
      message: 'Test market instruction ready',
      solana_instruction: instruction,
      marketPda: marketPda.toBase58(),
      voteTallyPda: voteTallyPda.toBase58(),
      platformAdmin,
      userWallet: adminPubkey.toBase58(),
      isAdmin: platformAdmin.toLowerCase() === adminPubkey.toBase58().toLowerCase(),
    });

  } catch (error) {
    console.error('createTestMarket error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});