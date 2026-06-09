import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { PublicKey, Connection } from 'npm:@solana/web3.js@1.98.4';
import { Buffer } from 'npm:buffer@6.0.3';
import { sha256 } from 'npm:@noble/hashes@1.4.0/sha256';

const SOLANA_PROGRAM_ID = Deno.env.get('SOLANA_PROGRAM_ID');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const programId = new PublicKey(SOLANA_PROGRAM_ID);

    // Calculate all possible discriminator formats for sweep_market_funds
    const discriminators = {
      'global:sweep_market_funds': Buffer.from(sha256('global:sweep_market_funds')).slice(0, 8).toString('hex'),
      'global:sweepMarketFunds': Buffer.from(sha256('global:sweepMarketFunds')).slice(0, 8).toString('hex'),
      'account:sweep_market_funds': Buffer.from(sha256('account:sweep_market_funds')).slice(0, 8).toString('hex'),
      'account:sweepMarketFunds': Buffer.from(sha256('account:sweepMarketFunds')).slice(0, 8).toString('hex'),
      'sweep_market_funds': Buffer.from(sha256('sweep_market_funds')).slice(0, 8).toString('hex'),
      'sweepMarketFunds': Buffer.from(sha256('sweepMarketFunds')).slice(0, 8).toString('hex'),
    };

    console.log('[testSweepDiscriminator] All possible discriminator formats:');
    Object.entries(discriminators).forEach(([format, hex]) => {
      console.log(`  ${format}: ${hex}`);
    });

    // Also check what discriminators are being used by working instructions
    const workingDiscriminators = {
      'global:create_market': Buffer.from(sha256('global:create_market')).slice(0, 8).toString('hex'),
      'global:initialize_platform': Buffer.from(sha256('global:initialize_platform')).slice(0, 8).toString('hex'),
      'global:update_market_timestamps': Buffer.from(sha256('global:update_market_timestamps')).slice(0, 8).toString('hex'),
      'global:submit_oracle_vote': Buffer.from(sha256('global:submit_oracle_vote')).slice(0, 8).toString('hex'),
      'global:force_settle_market': Buffer.from(sha256('global:force_settle_market')).slice(0, 8).toString('hex'),
      'global:withdraw_liquidity': Buffer.from(sha256('global:withdraw_liquidity')).slice(0, 8).toString('hex'),
    };

    console.log('\n[testSweepDiscriminator] Working discriminators for reference:');
    Object.entries(workingDiscriminators).forEach(([format, hex]) => {
      console.log(`  ${format}: ${hex}`);
    });

    return Response.json({
      success: true,
      sweep_market_funds_discriminators: discriminators,
      reference_discriminators: workingDiscriminators,
      note: 'The deployed program may not have sweep_market_funds instruction. Check the program deployment date vs when the instruction was added to Rust code.',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});