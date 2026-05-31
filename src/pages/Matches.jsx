import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Trophy, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MatchCard from '@/components/betting/MatchCard';

export default function Matches() {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const { data: matches = [] } = useQuery({
    queryKey: ['matches'],
    queryFn: () => base44.entities.Match.list('-match_time', 100),
  });

  const { data: bets = [] } = useQuery({
    queryKey: ['bets'],
    queryFn: () => base44.entities.Bet.list('-created_date', 100),
  });

  const betByMatch = {};
  bets.forEach(b => { betByMatch[b.match_id] = b; });

  const filtered = matches.filter(m => {
    if (filter !== 'all' && m.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return m.team_a?.toLowerCase().includes(q) || m.team_b?.toLowerCase().includes(q) || m.group_stage?.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading font-black text-2xl mb-1">Matches</h1>
        <p className="text-sm text-muted-foreground">Browse all World Cup 2026 matches and active bets</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search teams..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 bg-secondary/50 border-border/50 h-10 rounded-xl"
          />
        </div>
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList className="bg-secondary/50 rounded-xl">
            <TabsTrigger value="all" className="rounded-lg text-xs">All</TabsTrigger>
            <TabsTrigger value="live" className="rounded-lg text-xs">Live</TabsTrigger>
            <TabsTrigger value="upcoming" className="rounded-lg text-xs">Upcoming</TabsTrigger>
            <TabsTrigger value="finished" className="rounded-lg text-xs">Finished</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {filtered.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((m, i) => (
            <MatchCard key={m.id} match={m} bet={betByMatch[m.id]} index={i} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <Trophy className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No matches found</p>
        </div>
      )}
    </div>
  );
}