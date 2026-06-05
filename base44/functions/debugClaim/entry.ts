import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { PublicKey } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'node:buffer';

const SOLANA_PROGRAM_ID = Deno.env.get('SOLANA__PROGRAM_ID') || 'PMut1111111111111111111111111111111111111111';

/**
 * Comprehensive debug for claim issues - checks ALL on-chain state
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const serviceRole = base44.asServiceRole;
    
    const payload = await req.json();
    const { userBetId, walletAddress } = payload;
    
    console.log('[debugClaim] Starting comprehensive claim debug...');
    console.log('[debugClaim] userBetId:', userBetId);
    console.log('[debugClaim] walletAddress:', walletAddress);
    
    // Get all user bets for this wallet
    const allUserBets = await serviceRole.entities.UserBet.list();
    const userBets = allUserBets.filter(ub => ub.wallet_address === walletAddress);
    
    console.log('[debugClaim] Found', userBets.length, 'bets for this wallet');
    
    if (userBets.length === 0) {
      return Response.json({
        error: 'No bets found for this wallet',
        walletAddress,
      });
    }
    
    // Check platform and fee vault
    const { Connection: SolanaConnection } = await import('npm:@solana/web3.js@1.98.4');
    const connection = new SolanaConnection('https://api.devnet.solana.com', 'confirmed');
    const programId = new PublicKey(SOLANA_PROGRAM_ID);
    
    const [platformPda] = PublicKey.findProgramAddressSync([Buffer.from('platform')], programId);
    const [feeVaultPda] = PublicKey.findProgramAddressSync([Buffer.from('fee_vault')], programId);
    
    const [platformInfo, feeVaultInfo] = await Promise.all([
      connection.getAccountInfo(platformPda),
      connection.getAccountInfo(feeVaultPda),
    ]);
    
    const result = {
      walletAddress,
      totalBets: userBets.length,
      platformExists: !!platformInfo,
      feeVaultExists: !!feeVaultInfo,
      userBets: [],
      claimableBets: [],
      blockingIssues: [],
      totalClaimable: 0,
    };
    
    // Check each bet
    for (const ub of userBets) {
      const betInfo = {
        id: ub.id,
        status: ub.status,
        outcome: ub.outcome,
        amount: ub.amount,
        potential_payout: ub.potential_payout,
        match_id: ub.match_id,
      };
      
      // Check on-chain position
      const bets = await serviceRole.entities.Bet.filter({ id: ub.bet_id });
      const bet = bets[0];
      
      if (!bet) {
        betInfo.error = 'Bet entity not found';
        result.userBets.push(betInfo);
        continue;
      }
      
      betInfo.bet_status = bet.status;
      betInfo.winning_outcome = bet.winning_outcome;
      
      // Derive market PDA
      const matchIdBytes = Buffer.alloc(32);
      Buffer.from(ub.match_id, 'utf-8').copy(matchIdBytes, 0, 0, Math.min(ub.match_id.length, 32));
      const [marketPda] = PublicKey.findProgramAddressSync([Buffer.from('market'), matchIdBytes], programId);
      const [positionPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('position'), marketPda.toBuffer(), new PublicKey(ub.wallet_address).toBuffer()],
        programId
      );
      
      const [marketInfo, positionInfo] = await Promise.all([
        connection.getAccountInfo(marketPda),
        connection.getAccountInfo(positionPda),
      ]);
      
      betInfo.marketExists = !!marketInfo;
      betInfo.positionExists = !!positionInfo;
      
      if (marketInfo && marketInfo.data.length >= 249) {
        betInfo.onChain = {
          settled: marketInfo.data[244] === 1,
          voided: marketInfo.data[245] === 1,
          lamports: marketInfo.lamports,
        };
      }
      
      if (positionInfo && positionInfo.data.length >= 115) {
        const posData = positionInfo.data;
        betInfo.positionData = {
          outcome: posData[72],
          matched_stake: Number(posData.readBigUInt64LE(73)),
          potential_payout: Number(posData.readBigUInt64LE(97)),
          claimable: Number(posData.readBigUInt64LE(105)),
          claimed: posData[113] === 1,
        };
      }
      
      result.userBets.push(betInfo);
      
      // Check if claimable
      const isWon = ub.status === 'won';
      const isSettled = betInfo.onChain?.settled;
      const notClaimed = !betInfo.positionData?.claimed;
      const hasPayout = (betInfo.positionData?.claimable || ub.potential_payout || 0) > 0;
      
      if (isWon && isSettled && notClaimed && hasPayout) {
        result.claimableBets.push(ub.id);
        result.totalClaimable += (betInfo.positionData?.claimable || ub.potential_payout || 0);
      }
    }
    
    // Add blocking issues
    if (!result.feeVaultExists) {
      result.blockingIssues.push('Fee vault not initialized - platform setup incomplete');
    }
    if (result.claimableBets.length === 0 && result.userBets.length > 0) {
      result.blockingIssues.push('No bets are ready to claim (either not won, not settled, or already claimed)');
    }
    
    console.log('[debugClaim] Result:', result);
    
    return Response.json(result);
    
  } catch (error) {
    console.error('[debugClaim] Error:', error);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});