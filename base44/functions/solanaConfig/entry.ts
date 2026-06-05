/**
 * Centralized Solana configuration
 * All functions MUST use this constant - no hardcoded fallbacks allowed
 */
export const SOLANA_PROGRAM_ID = Deno.env.get('SOLANA__PROGRAM_ID') || '4epUYJPwoPhG9RPoQ6qT9dsAewJCDBSCGUpR1Xj9UxTm';
export const SOLANA_RPC_URL = 'https://api.devnet.solana.com';