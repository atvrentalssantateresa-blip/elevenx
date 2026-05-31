import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, ArrowRight, Flame, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MatchCard from '@/components/betting/MatchCard';
import StatsGrid from '@/components/betting/StatsGrid';

export default function Home() {
  const { data: matches = [] } = useQuery({
    queryKey: ['matches'],
    queryFn: () => base44.entities.Match.list('-created_date', 20),
  });

  const { data: bets = [] } = useQuery({
    queryKey: ['bets'],
    queryFn: () => base44.entities.Bet.list('-created_date', 50),
  });

  const { data: userBets = [] } = useQuery({
    queryKey: ['allUserBets'],
    queryFn: () => base44.entities.UserBet.list('-created_date', 100),
  });

  const openBets = bets.filter(b => b.status === 'open');
  const liveMatches = matches.filter(m => m.status === 'live');
  const upcomingMatches = matches.filter(m => m.status === 'upcoming');

  // Build bet lookup by match_id
  const betByMatch = {};
  bets.forEach(b => { betByMatch[b.match_id] = b; });

  const stats = {
    totalVolume: bets.reduce((s, b) => s + (b.total_pool || 0), 0),
    activeBettors: new Set(userBets.map(ub => ub.created_by_id)).size,
    openBets: openBets.length,
    totalMatches: matches.length,
  };

  return (
    <div className="space-y-8">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-card via-card to-secondary/30 border border-border/50 p-6 md:p-10"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <div className="px-3 py-1 bg-primary/10 rounded-full flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold text-primary">LIVE NOW</span>
            </div>
            <span className="text-xs text-muted-foreground">FIFA World Cup 2026™</span>
          </div>

          <h1 className="font-heading font-black text-3xl md:text-5xl text-foreground leading-tight mb-3">
            Bet on the<br />
            <span className="text-primary">Beautiful Game</span>
          </h1>
          <p className="text-muted-foreground max-w-md text-sm md:text-base mb-6">
            Peer-to-peer match betting for the FIFA World Cup 2026. No bookmakers, no middlemen — just pure football.
          </p>

          <div className="flex gap-3">
            <Link to="/matches">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-heading font-bold px-6 h-11 rounded-xl">
                <Trophy className="w-4 h-4 mr-2" />
                Browse Matches
              </Button>
            </Link>
            <Link to="/my-bets">
              <Button variant="outline" className="font-heading font-medium h-11 rounded-xl border-border/50">
                My Bets
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <StatsGrid stats={stats} />

      {/* Live Matches */}
      {liveMatches.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
            <h2 className="font-heading font-bold text-lg">Live Matches</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {liveMatches.map((m, i) => (
              <MatchCard key={m.id} match={m} bet={betByMatch[m.id]} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* Open Bets */}
      {openBets.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h2 className="font-heading font-bold text-lg">Open Bets</h2>
            </div>
            <Link to="/matches" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {openBets.slice(0, 4).map((bet, i) => {
              const match = matches.find(m => m.id === bet.match_id);
              if (!match) return null;
              return <MatchCard key={bet.id} match={match} bet={bet} index={i} />;
            })}
          </div>
        </section>
      )}

      {/* Upcoming */}
      {upcomingMatches.length > 0 && (
        <section>
          <h2 className="font-heading font-bold text-lg mb-4">Upcoming Matches</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingMatches.slice(0, 6).map((m, i) => (
              <MatchCard key={m.id} match={m} bet={betByMatch[m.id]} index={i} />
            ))}
          </div>
        </section>
      )}

      {matches.length === 0 && (
        <div className="text-center py-20">
          <Trophy className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">No matches yet</p>
          <p className="text-xs text-muted-foreground mt-1">Matches will appear here once an admin creates them.</p>
        </div>
      )}
    </div>
  );
}