import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Export all matches as CSV with match_ids and timing.
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
    
    // Build CSV
    const csvRows = [
      ['match_id', 'team_a', 'team_b', 'team_a_flag', 'team_b_flag', 'group_stage', 'venue', 'match_time', 'match_end_time', 'status', 'score_a', 'score_b', 'winner'].join(',')
    ];
    
    matches.forEach((match) => {
      const row = [
        match.id,
        `"${match.team_a || ''}"`,
        `"${match.team_b || ''}"`,
        `"${match.team_a_flag || ''}"`,
        `"${match.team_b_flag || ''}"`,
        `"${match.group_stage || ''}"`,
        `"${match.venue || ''}"`,
        match.match_time,
        match.match_end_time,
        match.status || 'upcoming',
        match.score_a || 0,
        match.score_b || 0,
        `"${match.winner || ''}"`
      ].join(',');
      csvRows.push(row);
    });
    
    const csvContent = csvRows.join('\n');
    
    // Return as downloadable CSV
    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="matches_export.csv"',
      },
    });
    
  } catch (error) {
    console.error('[exportMatches] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});