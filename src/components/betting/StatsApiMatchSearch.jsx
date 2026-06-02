import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

export default function StatsApiMatchSearch({ teamA, teamB, onSelect }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);

  const search = async () => {
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      // Search by team A name first
      const res = await base44.functions.invoke('searchStatsApiMatches', {
        team_name: teamA,
      });
      if (res.data.error) throw new Error(res.data.error);
      setResults(res.data.matches || []);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div className="mt-2 space-y-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={search}
        disabled={loading}
        className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
        Search TheStatsAPI for "{teamA}"
      </Button>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {searched && !loading && results.length === 0 && (
        <p className="text-xs text-muted-foreground">No matches found. Try a different search.</p>
      )}

      {results.length > 0 && (
        <div className="space-y-1 max-h-52 overflow-y-auto rounded-xl border border-border/40 bg-secondary/20 p-2">
          {results.map(m => (
            <button
              key={m.id}
              onClick={() => onSelect(m.id)}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-secondary/60 transition-colors flex items-center justify-between gap-2 group"
            >
              <div>
                <p className="text-xs font-bold text-foreground">
                  {m.home} <span className="text-muted-foreground font-normal">vs</span> {m.away}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {m.competition} · {m.date ? format(new Date(m.date), 'MMM d, yyyy HH:mm') : '—'} · <span className="font-mono">{m.id}</span>
                </p>
              </div>
              <Check className="w-3 h-3 text-accent opacity-0 group-hover:opacity-100 flex-shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}