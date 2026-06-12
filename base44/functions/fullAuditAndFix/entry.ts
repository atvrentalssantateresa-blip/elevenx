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

    const { rpcUrl, programIdStr, programId, connection } = getSolanaConfig();
    const [platformPda] = PublicKey.findProgramAddressSync([Buffer.from('platform')], programId);
    const [feeVaultPda] = PublicKey.findProgramAddressSync([Buffer.from('fee_vault')], programId);

    const report = {
      timestamp: new Date().toISOString(),
      platform: { status: 'unknown', admin: null, feeVault: null },
      markets: { total: 0, deployed: 0, notDeployed: 0, settled: 0, dead: 0, timestamps: 0 },
      bets: { total: 0, open: 0, closed: 0, settled: 0, void: 0 },
      matches: { total: 0, upcoming: 0, live: 0, finished: 0, cancelled: 0 },
      lpPositions: { total: 0, synced: 0, outOfSync: 0 },
      userBets: { total: 0, active: 0, won: 0, lost: 0, claimed: 0, pending: 0 },
      futures: { total: 0, deployed: 0, notDeployed: 0 },
      fixesApplied: [],
      errors: [],
    };

    // 1. Platform Check
    try {
      const platformInfo = await connection.getAccountInfo(platformPda);
      if (platformInfo) {
        report.platform.status = 'initialized';
        report.platform.feeVaultPda = feeVaultPda.toBase58();
        
        const feeVaultInfo = await connection.getAccountInfo(feeVaultPda);
        if (feeVaultInfo) {
          report.platform.feeVaultBalance = feeVaultInfo.lamports / 1e9;
        }
      } else {
        report.platform.status = 'not_initialized';
        report.errors.push('Platform not initialized on-chain');
      }
    } catch (err) {
      report.platform.status = 'error';
      report.errors.push('Platform check failed: ' + err.message);
    }

    // 2. Fetch all entities
    const allBets = await base44.asServiceRole.entities.Bet.filter({});
    const allMatches = await base44.asServiceRole.entities.Match.filter({});
    const allLpPositions = await base44.asServiceRole.entities.LpPosition.filter({});
    const allUserBets = await base44.asServiceRole.entities.UserBet.filter({});
    const allFutures = await base44.asServiceRole.entities.FuturesMarket.filter({});

    report.bets.total = allBets.length;
    report.matches.total = allMatches.length;
    report.lpPositions.total = allLpPositions.length;
    report.userBets.total = allUserBets.length;
    report.futures.total = allFutures.length;

    // 3. Bet status audit
    allBets.forEach(bet => {
      if (bet.status === 'open') report.bets.open++;
      else if (bet.status === 'closed') report.bets.closed++;
      else if (bet.status === 'settled') report.bets.settled++;
      else if (bet.status === 'void') report.bets.void++;
      
      if (bet.solana_market_pda) {
        report.markets.deployed++;
        if (bet.odds_a === 0 && bet.odds_b === 0 && bet.odds_draw === 0) {
          report.markets.dead++;
        }
      } else {
        report.markets.notDeployed++;
      }
    });

    // 4. Match status audit
    allMatches.forEach(match => {
      if (match.status === 'upcoming') report.matches.upcoming++;
      else if (match.status === 'live') report.matches.live++;
      else if (match.status === 'finished') report.matches.finished++;
      else if (match.status === 'cancelled') report.matches.cancelled++;
    });

    // 5. On-chain market audit
    console.log('[fullAuditAndFix] Auditing', report.markets.deployed, 'deployed markets on-chain...');
    let auditedCount = 0;
    for (const bet of allBets) {
      if (!bet.solana_market_pda) continue;
      
      try {
        const marketPda = new PublicKey(bet.solana_market_pda);
        const marketInfo = await connection.getAccountInfo(marketPda);
        
        if (!marketInfo) {
          report.errors.push(`Market PDA not found: ${bet.solana_market_pda}`);
          continue;
        }
        
        auditedCount++;
        const data = marketInfo.data;
        
        // Check settlement status (byte 155: is_settled u8)
        const isSettled = data[155] === 1;
        if (isSettled && bet.status !== 'settled' && bet.status !== 'void') {
          report.markets.timestamps++;
          report.fixesApplied.push(`Market ${bet.id} settled on-chain but DB not updated`);
        }
        
        // Check oracle_odds at offset 156 (3x u64)
        const readU64LE = (offset) => {
          const buf = data.slice(offset, offset + 8);
          return Number(buf.readBigUInt64LE(0));
        };
        
        const oracleOddsA = readU64LE(156);
        const oracleOddsB = readU64LE(164);
        const oracleOddsDraw = readU64LE(172);
        
        if (oracleOddsA === 0 && oracleOddsB === 0 && oracleOddsDraw === 0) {
          if (bet.odds_a > 0 || bet.odds_b > 0 || bet.odds_draw > 0) {
            report.markets.dead++;
            report.fixesApplied.push(`Market ${bet.id} has dead on-chain odds but DB has valid odds`);
          }
        }
        
      } catch (err) {
        report.errors.push(`Failed to audit market ${bet.solana_market_pda}: ${err.message}`);
      }
      
      if (auditedCount % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // 6. LP Position sync audit
    let lpSynced = 0;
    let lpOutOfSync = 0;
    for (const lpPos of allLpPositions) {
      const expectedUnmatched = Math.max(0, lpPos.liquidity_deposited - lpPos.liquidity_matched);
      const tolerance = 0.0001;
      
      if (Math.abs(lpPos.liquidity_unmatched - expectedUnmatched) < tolerance) {
        lpSynced++;
      } else {
        lpOutOfSync++;
        report.fixesApplied.push(`LP Position ${lpPos.id} out of sync: DB=${lpPos.liquidity_unmatched}, Expected=${expectedUnmatched}`);
        
        try {
          await base44.asServiceRole.entities.LpPosition.update(lpPos.id, {
            liquidity_unmatched: expectedUnmatched,
            status: expectedUnmatched > 0 ? 'open' : (lpPos.liquidity_matched > 0 ? 'fully_matched' : 'open'),
          });
        } catch (err) {
          report.errors.push(`Failed to fix LP position ${lpPos.id}: ${err.message}`);
        }
      }
    }
    report.lpPositions.synced = lpSynced;
    report.lpPositions.outOfSync = lpOutOfSync;

    // 7. UserBet status audit
    allUserBets.forEach(bet => {
      if (bet.status === 'active') report.userBets.active++;
      else if (bet.status === 'won') report.userBets.won++;
      else if (bet.status === 'lost') report.userBets.lost++;
      else if (bet.status === 'claimed') report.userBets.claimed++;
      else if (bet.status === 'pending') report.userBets.pending++;
    });

    // 8. Futures market audit
    allFutures.forEach(futures => {
      if (futures.solana_market_pda) {
        report.futures.deployed++;
      } else {
        report.futures.notDeployed++;
      }
    });

    // 9. Orphan bet check
    const matchIds = new Set(allMatches.map(m => m.id));
    let orphanBets = 0;
    for (const bet of allBets) {
      if (!matchIds.has(bet.match_id)) {
        orphanBets++;
        report.errors.push(`Orphan bet ${bet.id} references non-existent match ${bet.match_id}`);
      }
    }
    if (orphanBets > 0) {
      report.fixesApplied.push(`Found ${orphanBets} orphan bets - consider running syncBetsToMatches`);
    }

    // 10. Admin wallet check
    const adminWallet = await base44.asServiceRole.entities.WalletUser.filter({ role: 'admin' });
    report.adminWallets = adminWallet.map(w => w.wallet_address);
    
    if (adminWallet.length === 0) {
      report.errors.push('No admin wallet registered in WalletUser table');
    } else if (adminWallet.length > 1) {
      report.warnings = [`Multiple admin wallets found: ${adminWallet.length}`];
    }

    // Summary
    report.summary = {
      health: report.errors.length === 0 ? 'healthy' : 'issues_found',
      criticalIssues: report.errors.filter(e => 
        e.includes('Platform not initialized') || 
        e.includes('No admin wallet') ||
        e.includes('orphan bet')
      ).length,
      totalFixesApplied: report.fixesApplied.length,
      marketsNeedingAttention: report.markets.dead + report.markets.timestamps,
    };

    return Response.json(report);

  } catch (error) {
    console.error('fullAuditAndFix error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
});