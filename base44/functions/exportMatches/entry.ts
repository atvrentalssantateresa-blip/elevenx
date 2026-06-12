import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Export all matches as plain text list with match_ids and timing.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify admin access
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - admin only' }, { status: 403 });
    }
    
    // Fetch all matches
    const matches = await base44.entities.Match.list('-match_time', 500);
    
    // Build formatted text output
    const lines = [];
    lines.push('=== ELEVENX MATCH LIST ===');
    lines.push(`Total Matches: ${matches.length}`);
    lines.push('All times in UTC (Costa Rica = UTC-6)\n');
    lines.push('─'.repeat(80));
    
    matches.forEach((match, index) => {
      const matchDate = new Date(match.match_time);
      const costaRicaTime = new Date(matchDate.getTime() - 6 * 60 * 60 * 1000);
      
      lines.push(`\n${index + 1}. ${match.team_a} ${match.team_a_flag || ''} vs ${match.team_b} ${match.team_b_flag || ''}`);
      lines.push(`   Match ID: ${match.id}`);
      lines.push(`   UTC Time: ${match.match_time}`);
      lines.push(`   Costa Rica Time: ${costaRicaTime.toISOString().replace('.000Z', '')}`);
      lines.push(`   Group: ${match.group_stage || 'TBD'}`);
      lines.push(`   Venue: ${match.venue || 'TBD'}`);
      lines.push(`   Status: ${match.status || 'upcoming'}`);
      if (match.score_a || match.score_b) {
        lines.push(`   Score: ${match.score_a || 0} - ${match.score_b || 0}`);
      }
      if (match.winner) {
        lines.push(`   Winner: ${match.winner}`);
      }
    });
    
    lines.push('\n' + '─'.repeat(80));
    lines.push(`Exported: ${new Date().toISOString()}`);
    
    return Response.json({ 
      content: lines.join('\n'),
      count: matches.length 
    });
    
  } catch (error) {
    console.error('[exportMatches] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});