import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Trophy, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import MatchCard from '@/components/betting/MatchCard';
import { motion } from 'framer-motion';

export default function Matches() {
  const [activeGroup, setActiveGroup] = useState('all');
  const [search, setSearch] = useState('');

  const { data: rawMatches = [] } = useQuery({
    queryKey: ['matches'],
    queryFn: () => base44.entities.Match.list('match_time', 100),
  });

  // Deduplicate matches by unique game properties
  const seenMatches = new Set();
  const matches = rawMatches.filter(m => {
    const matchKey = `${m.team_a}|${m.team_b}|${m.group_stage || ''}|${m.match_time || ''}`;
    if (seenMatches.has(matchKey)) return false;
    seenMatches.add(matchKey);
    return true;
  });

  const { data: bets = [] } = useQuery({
    queryKey: ['bets'],
    queryFn: () => base44.entities.Bet.filter({}),
  });

  const betByMatch = {};
  bets.forEach(b => { betByMatch[b.match_id] = b; });

  // Extract unique groups from matches
  const groupSet = new Set(matches.map(m => m.group_stage).filter(Boolean));
  const groups = ['all', ...Array.from(groupSet).sort()];

  // Filter by active group, search, and date (up to June 27, 2026)
  const cutoffDate = new Date('2026-06-27T23:59:59Z');
  const filtered = matches.filter(m => {
    if (activeGroup !== 'all' && m.group_stage !== activeGroup) return false;
    if (search) {
      const q = search.toLowerCase();
      return m.team_a?.toLowerCase().includes(q) || m.team_b?.toLowerCase().includes(q);
    }
    // Only show matches up to June 27, 2026
    if (m.match_time && new Date(m.match_time) > cutoffDate) return false;
    return true;
  });

  // Sort filtered matches by date
  const sortedMatches = [...filtered].sort((a, b) => {
    if (!a.match_time) return 1;
    if (!b.match_time) return -1;
    return new Date(a.match_time) - new Date(b.match_time);
  });

  // Group matches by date within the active group
  const groupedByDate = {};
  sortedMatches.forEach(m => {
    const dateKey = m.match_time ? format(new Date(m.match_time), 'yyyy-MM-dd') : 'TBD';
    const dateLabel = m.match_time ? format(new Date(m.match_time), 'EEEE, MMM d · yyyy') : 'TBD';
    if (!groupedByDate[dateKey]) groupedByDate[dateKey] = { label: dateLabel, matches: [] };
    groupedByDate[dateKey].matches.push(m);
  });

  const sortedDates = Object.keys(groupedByDate).sort();

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl p-8"
        style={{ background: 'linear-gradient(135deg, #1a1040 0%, #0f0a1e 50%, #12102a 100%)' }}
      >
        <div className="absolute top-0 right-0 w-56 h-56 rounded-full blur-3xl opacity-30" style={{ background: '#a69cf2' }} />
        <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full blur-3xl opacity-20" style={{ background: '#14f195' }} />
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1.5 bg-primary/20 border border-primary/30 px-3 py-1 rounded-full">
              <Trophy className="w-3 h-3 text-primary" />
              <span className="text-[11px] font-bold text-primary tracking-widest">WORLD CUP 2026</span>
            </div>
          </div>
          <h1 className="font-heading font-black text-3xl md:text-4xl leading-tight mb-2 text-white">
            Match Schedule
          </h1>
          <p className="text-white/60 text-sm max-w-md">
            Browse all 104 matches from the group stage to the final. Search by team, filter by group, and bet P2P on every match.
          </p>
        </div>
      </motion.div>

      {/* Search & Group Filter */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-3"
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search teams..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 bg-card border-border/50 h-11 rounded-xl"
          />
        </div>

        {/* Group Filter Tabs */}
        <Tabs value={activeGroup} onValueChange={setActiveGroup}>
          <TabsList className="bg-card border border-border/50 rounded-xl w-full overflow-x-auto max-w-full">
            {groups.map(g => (
              <TabsTrigger key={g} value={g} className="rounded-lg text-xs whitespace-nowrap">
                {g === 'all' ? 'All Groups' : g}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </motion.div>

      {sortedMatches.length > 0 ? (
        <div className="space-y-8">
          {sortedDates.map((dateKey, dateIndex) => {
            const { label, matches: dateMatches } = groupedByDate[dateKey];
            return (
              <motion.div
                key={dateKey}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: dateIndex * 0.05, duration: 0.4 }}
              >
                {/* Date header */}
                <div className="flex items-center gap-3 mb-5 sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-3">
                  <div className="flex items-center gap-2.5 bg-gradient-to-r from-primary/15 to-primary/5 border border-primary/30 rounded-2xl px-4 py-2 shadow-lg">
                    <span className="font-heading font-bold text-base text-primary">{label}</span>
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-r from-border/50 to-transparent" />
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dateMatches.map((m, i) => (
                    <MatchCard key={m.id} match={m} bet={betByMatch[m.id]} index={i} />
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20 bg-card border border-border/50 rounded-3xl"
        >
          <Trophy className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">No matches found</p>
        </motion.div>
      )}
    </div>
  );
}