import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { Connection, PublicKey } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'node:buffer';

function getSolanaConfig() {
  let rawUrl = Deno.env.get('SOLANA_RPC_URL') || '';
  if (rawUrl.includes('RPC_URL=')) {
    rawUrl = rawUrl.split('RPC_URL=')[1].trim();
  }
  if (!rawUrl.startsWith('http') || rawUrl.includes('uuid')) {
    rawUrl = 'https://api.mainnet-beta.solana.com';
  }
  const rpcUrl = rawUrl;
  const programIdStr = Deno.env.get('ELEVENX_PROGRAM_ID') || '';
  if (!programIdStr) throw new Error('ELEVENX_PROGRAM_ID secret not set');
  return { rpcUrl, programIdStr, programId: new PublicKey(programIdStr), connection: new Connection(rpcUrl, 'confirmed') };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Support both platform auth and wallet-based auth
    let isAdmin = false;
    try {
      const user = await base44.auth.me();
      if (user && user.role === 'admin') isAdmin = true;
    } catch (_) {}

    if (!isAdmin) {
      try {
        const authHeader = req.headers.get('Authorization') || '';
        const token = authHeader.replace('Bearer ', '');
        if (token) {
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
            if (payload.walletAddress) {
              const walletUsers = await base44.asServiceRole.entities.WalletUser.filter({ wallet_address: payload.walletAddress });
              if (walletUsers[0]?.role === 'admin') isAdmin = true;
            }
          }
        }
      } catch (_) {}
    }

    if (!isAdmin) {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { programId, connection } = getSolanaConfig();
    
    // Get all bets and matches
    const allBets = await base44.asServiceRole.entities.Bet.filter({});
    const allMatches = await base44.asServiceRole.entities.Match.filter({});
    
    // Create match ID set for filtering
    const matchIds = new Set(allMatches.map(m => m.id));
    
    // Filter out orphan bets (bets without matching matches)
    const validBets = allBets.filter(b => matchIds.has(b.match_id));
    const orphanBets = allBets.filter(b => !matchIds.has(b.match_id));
    
    console.log(`[syncOnChainStatus] Total Bets: ${allBets.length}, Valid: ${validBets.length}, Orphans: ${orphanBets.length}`);
    console.log(`[syncOnChainStatus] Total Matches: ${allMatches.length}`);
    
    let updated = 0;
    let alreadyDeployed = 0;
    let notFound = 0;
    let settledCount = 0;
    const updatedBets = [];
    
    // Process in batches to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < validBets.length; i += batchSize) {
      const batch = validBets.slice(i, i + batchSize);
      
      for (const bet of batch) {
        // Derive market PDA
        const matchIdBytes = Buffer.alloc(32);
        Buffer.from(bet.match_id, 'utf-8').copy(matchIdBytes, 0, 0, Math.min(bet.match_id.length, 32));
        const [marketPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('market'), matchIdBytes],
          programId
        );
        
        // Check if market exists on-chain
        try {
          const accountInfo = await connection.getAccountInfo(marketPda);
          
          if (accountInfo && accountInfo.data.length > 0) {
            // Market exists - read settlement status from on-chain data
            // Byte 155: is_settled (u8)
            // Byte 276: winning_outcome (u8: 0=A, 1=B, 2=Draw)
            const isSettled = accountInfo.data[155] === 1;
            let winningOutcome = '';
            
            if (isSettled) {
              settledCount++;
              const outcomeByte = accountInfo.data[276];
              winningOutcome = outcomeByte === 0 ? 'a' : outcomeByte === 1 ? 'b' : outcomeByte === 2 ? 'draw' : '';
              console.log(`[syncOnChainStatus] ✓ Market ${bet.id} is settled. Winner: ${winningOutcome}`);
            }
            
            // Update database with on-chain status
            const updateData = {
              solana_market_created: true,
              solana_market_pda: marketPda.toBase58(),
            };
            
            // Track if already marked
            if (!bet.solana_market_created) {
              updated++;
            } else {
              alreadyDeployed++;
            }
            
            await base44.asServiceRole.entities.Bet.update(bet.id, updateData);
            
            updatedBets.push({
              bet_id: bet.id,
              match_id: bet.match_id,
              market_pda: marketPda.toBase58(),
              is_settled: isSettled,
              winning_outcome: winningOutcome,
            });
            
            if (!bet.solana_market_created) {
              console.log(`[syncOnChainStatus] ✓ Updated bet ${bet.id}: ${bet.title}`);
            }
          } else {
            notFound++;
            console.log(`[syncOnChainStatus] ✗ Market not found for bet ${bet.id}`);
          }
        } catch (err) {
          notFound++;
          console.error(`[syncOnChainStatus] Error checking market for bet ${bet.id}:`, err.message);
        }
      }
      
      // Small delay between batches to avoid rate limits
      if (i + batchSize < allBets.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    return Response.json({
      success: true,
      message: `✓ Sync complete! ${updated} updated, ${alreadyDeployed} already deployed, ${notFound} not found, ${settledCount} settled on-chain. Skipped ${orphanBets.length} orphan bets.`,
      totalBets: allBets.length,
      totalMatches: allMatches.length,
      orphanBets: orphanBets.length,
      validBets: validBets.length,
      updated,
      alreadyDeployed,
      notFound,
      settledCount,
      updatedBets,
    });
    
  } catch (error) {
    console.error('syncOnChainStatus error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});