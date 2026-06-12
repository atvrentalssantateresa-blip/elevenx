import { PublicKey } from '@solana/web3.js';
import { Buffer } from 'buffer';

// CRITICAL: Program ID must be set via environment variable - never hardcode
// This reads from the global window.ELEVENX_PROGRAM_ID set at app initialization
const getProgramId = () => {
  const programId = window.ELEVENX_PROGRAM_ID || '3ecFdHPbcU88UQ37iStPcGaz7Bg16RdSDDYqW5FzPabu';
  return programId;
};

/**
 * Derive market PDA from market ID
 * Seeds: ["market", marketIdBytes]
 */
export const deriveMarketPda = (marketId) => {
  const programId = new PublicKey(getProgramId());
  const marketIdBytes = Buffer.alloc(32);
  Buffer.from(marketId, 'utf-8').copy(marketIdBytes, 0, 0, Math.min(marketId.length, 32));
  const [marketPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('market'), marketIdBytes],
    programId
  );
  return marketPda.toBase58();
};

/**
 * Derive bet_position PDA
 * Seeds: ["position", marketPda, bettorWallet, [outcome]]
 */
export const deriveBetPositionPda = (marketPdaBase58, bettorWallet, outcomeIndex) => {
  const programId = new PublicKey(getProgramId());
  const marketPda = new PublicKey(marketPdaBase58);
  const bettorPubkey = new PublicKey(bettorWallet);
  
  const [betPositionPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('position'), marketPda.toBuffer(), bettorPubkey.toBuffer(), Buffer.from([outcomeIndex])],
    programId
  );
  return betPositionPda.toBase58();
};

/**
 * Derive fee_vault PDA
 * Seeds: ["fee_vault"]
 */
export const deriveFeeVaultPda = () => {
  const programId = new PublicKey(getProgramId());
  const [feeVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('fee_vault')],
    programId
  );
  return feeVaultPda.toBase58();
};

/**
 * Build claim_winnings instruction client-side
 * Discriminator: [161, 215, 24, 59, 14, 236, 242, 221]
 * Data: discriminator + outcome (u8)
 * Accounts: market, bet_position, fee_vault, bettor (signer), system_program
 */
export const buildClaimWinningsInstruction = (marketPdaBase58, bettorWallet, outcomeIndex) => {
  const programId = new PublicKey(getProgramId());
  const marketPda = new PublicKey(marketPdaBase58);
  const bettorPubkey = new PublicKey(bettorWallet);
  
  // Derive bet_position PDA
  const [betPositionPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('position'), marketPda.toBuffer(), bettorPubkey.toBuffer(), Buffer.from([outcomeIndex])],
    programId
  );
  
  // Derive fee_vault PDA
  const [feeVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('fee_vault')],
    programId
  );
  
  // Build instruction data: discriminator + outcome (u8)
  const discriminator = Buffer.from([161, 215, 24, 59, 14, 236, 242, 221]);
  const instructionData = Buffer.alloc(9);
  discriminator.copy(instructionData, 0);
  instructionData.writeUInt8(outcomeIndex, 8);
  
  // Accounts
  const keys = [
    { pubkey: marketPda.toBase58(), isSigner: false, isWritable: true },
    { pubkey: betPositionPda.toBase58(), isSigner: false, isWritable: true },
    { pubkey: feeVaultPda.toBase58(), isSigner: false, isWritable: true },
    { pubkey: bettorWallet, isSigner: true, isWritable: true },
    { pubkey: '11111111111111111111111111111111', isSigner: false, isWritable: false },
  ];
  
  return {
    instruction_type: 'claim_winnings',
    programId: getProgramId(),
    keys,
    instruction_data: instructionData.toString('base64'),
  };
};

/**
 * Derive lp_offer PDA
 * Seeds: ["lp_offer", marketPda, lpWallet, [outcome]]
 */
export const deriveLpOfferPda = (marketPdaBase58, lpWallet, outcomeIndex) => {
  const programId = new PublicKey(getProgramId());
  const marketPda = new PublicKey(marketPdaBase58);
  const lpPubkey = new PublicKey(lpWallet);
  
  const [lpOfferPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('lp_offer'), marketPda.toBuffer(), lpPubkey.toBuffer(), Buffer.from([outcomeIndex])],
    programId
  );
  return lpOfferPda.toBase58();
};

/**
 * Build withdraw_liquidity instruction client-side
 * Discriminator: SHA256("global:withdraw_liquidity").slice(0, 8)
 */
export const buildWithdrawLiquidityInstruction = async (marketPdaBase58, lpOfferPdaBase58, lpWallet) => {
  const programId = new PublicKey(getProgramId());
  const marketPda = new PublicKey(marketPdaBase58);
  const lpOfferPda = new PublicKey(lpOfferPdaBase58);
  const lpPubkey = new PublicKey(lpWallet);
  
  // Compute discriminator: SHA256("global:withdraw_liquidity").slice(0, 8)
  const msg = new TextEncoder().encode('global:withdraw_liquidity');
  const hash = await crypto.subtle.digest('SHA-256', msg);
  const discriminator = Buffer.from(new Uint8Array(hash).slice(0, 8));
  
  const instructionData = discriminator;
  
  // Accounts: market, lp_offer, lp (signer), system_program
  const keys = [
    { pubkey: marketPda.toBase58(), isSigner: false, isWritable: true },
    { pubkey: lpOfferPda.toBase58(), isSigner: false, isWritable: true },
    { pubkey: lpWallet, isSigner: true, isWritable: true },
    { pubkey: '11111111111111111111111111111111', isSigner: false, isWritable: false },
  ];
  
  return {
    instruction_type: 'withdraw_liquidity',
    programId: getProgramId(),
    keys,
    instruction_data: instructionData.toString('base64'),
  };
};