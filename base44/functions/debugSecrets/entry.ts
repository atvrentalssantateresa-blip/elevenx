import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Read the secret directly (both naming conventions)
    const programIdDouble = Deno.env.get('SOLANA__PROGRAM_ID');
    const programIdSingle = Deno.env.get('SOLANA_PROGRAM_ID');
    
    console.log('Secret check:', {
      SOLANA__PROGRAM_ID: programIdDouble ? 'exists' : 'missing',
      SOLANA_PROGRAM_ID: programIdSingle ? 'exists' : 'missing',
      valueDouble: programIdDouble || 'none',
      valueSingle: programIdSingle || 'none',
    });

    return Response.json({
      SOLANA__PROGRAM_ID: programIdDouble || 'not found',
      SOLANA_PROGRAM_ID: programIdSingle || 'not found',
      message: programIdDouble || programIdSingle 
        ? 'Secret found - try reloading the page'
        : 'Secret missing - please update in Dashboard → Code → Secrets',
    });

  } catch (error) {
    console.error('debugSecrets error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});