import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, ArrowRight, Flame, TrendingUp, Zap, Globe, Star, ChevronRight, Clock, Users, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MatchCard from '@/components/betting/MatchCard';

const WC_PHOTOS = [
  'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&q=80',
  'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&q=80',
  'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80',
  'https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?w=800&q=80',
];

const FEATURED_MATCHES = [
  { flag_a: '🇧🇷', flag_b: '🇦🇷', team_a: 'Brazil', team_b: 'Argentina', group: 'Group C', odds_a: '2.1', odds_b: '3.4', pool: '$48,200' },
  { flag_a: '🇫🇷', flag_b: '🇩🇪', team_a: 'France', team_b: 'Germany', group: 'Group A', odds_a: '1.8', odds_b: '2.9', pool: '$62,100' },
  { flag_a: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', flag_b: '🇪🇸', team_a: 'England', team_b: 'Spain', group: 'Group D', odds_a: '2.5', odds_b: '2.2', pool: '$35,800' },
];

export default function Home() {
  const [activePhoto, setActivePhoto] = useState(0);

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

  const betByMatch = {};
  bets.forEach(b => { betByMatch[b.match_id] = b; });

  const totalVolume = bets.reduce((s, b) => s + (b.total_pool || 0), 0);
  const activeBettors = new Set(userBets.map(ub => ub.created_by_id)).size;

  return (
    <div className="space-y-6 -mt-2">

      {/* ── HERO ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl min-h-[420px] md:min-h-[500px] flex flex-col justify-end"
      >
        {/* BG photo */}
        <img
          src={WC_PHOTOS[activePhoto]}
          alt="World Cup"
          className="absolute inset-0 w-full h-full object-cover transition-all duration-700"
        />
        {/* Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-transparent" />

        {/* Top badge row */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-destructive/90 backdrop-blur-sm px-3 py-1 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              <span className="text-xs font-bold text-white tracking-wide">LIVE</span>
            </div>
            <div className="bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full">
              <span className="text-xs font-semibold text-white/90">FIFA World Cup 2026™</span>
            </div>
          </div>
          {/* Photo dots */}
          <div className="flex gap-1.5">
            {WC_PHOTOS.map((_, i) => (
              <button
                key={i}
                onClick={() => setActivePhoto(i)}
                className={`w-2 h-2 rounded-full transition-all ${i === activePhoto ? 'bg-primary w-5' : 'bg-white/40'}`}
              />
            ))}
          </div>
        </div>

        {/* Hero content */}
        <div className="relative z-10 p-6 md:p-10">
          <div className="flex items-center gap-2 mb-3">
            <Flame className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold text-primary tracking-widest uppercase">P2P · On-Chain · Solana</span>
          </div>
          <h1 className="font-heading font-black text-4xl md:text-6xl text-white leading-none mb-3">
            The World's<br />
            <span className="text-primary drop-shadow-[0_0_30px_hsl(45,100%,51%,0.5)]">Biggest Bets</span>
          </h1>
          <p className="text-white/70 max-w-sm text-sm md:text-base mb-6">
            No bookmakers. No middlemen. Pure peer-to-peer betting on the World Cup — settled on-chain.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link to="/matches">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-heading font-bold px-7 h-12 rounded-xl text-sm shadow-[0_0_20px_hsl(45,100%,51%,0.3)]">
                <Zap className="w-4 h-4 mr-2" />
                Place a Bet
              </Button>
            </Link>
            <Link to="/my-bets">
              <Button variant="outline" className="font-heading font-medium h-12 rounded-xl border-white/20 text-white bg-white/5 backdrop-blur-sm hover:bg-white/10">
                My Bets
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </motion.div>

      {/* ── LIVE STATS BAR ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
      >
        {[
          { icon: DollarSign, label: 'Total Volume', value: `$${totalVolume.toLocaleString()}`, color: 'text-primary', bg: 'bg-primary/10' },
          { icon: Users, label: 'Active Bettors', value: activeBettors.toString(), color: 'text-accent', bg: 'bg-accent/10' },
          { icon: Flame, label: 'Open Bets', value: openBets.length.toString(), color: 'text-orange-400', bg: 'bg-orange-400/10' },
          { icon: Globe, label: 'Matches', value: matches.length.toString(), color: 'text-blue-400', bg: 'bg-blue-400/10' },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 + i * 0.05 }}
            className="bg-card border border-border/50 rounded-2xl p-4 flex items-center gap-3"
          >
            <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center flex-shrink-0`}>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className={`font-heading font-bold text-lg leading-tight ${stat.color}`}>{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* ── FEATURED MATCHES HORIZONTAL SCROLL ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-primary" />
            <h2 className="font-heading font-bold text-lg">Featured Matches</h2>
          </div>
          <Link to="/matches" className="flex items-center gap-1 text-xs text-primary hover:underline font-medium">
            View all <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
          {FEATURED_MATCHES.map((fm, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              className="flex-shrink-0 w-72 bg-card border border-border/50 rounded-2xl overflow-hidden"
            >
              {/* Match photo strip */}
              <div className="relative h-28 overflow-hidden">
                <img
                  src={WC_PHOTOS[(i + 1) % WC_PHOTOS.length]}
                  alt="match"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
                <div className="absolute top-2 left-2">
                  <span className="text-[10px] font-bold bg-primary/90 text-primary-foreground px-2 py-0.5 rounded-full">{fm.group}</span>
                </div>
                <div className="absolute top-2 right-2">
                  <span className="text-[10px] font-bold bg-accent/20 text-accent px-2 py-0.5 rounded-full border border-accent/30">OPEN</span>
                </div>
              </div>

              <div className="p-4">
                {/* Teams */}
                <div className="flex items-center justify-between mb-4">
                  <div className="text-center flex-1">
                    <div className="text-2xl mb-1">{fm.flag_a}</div>
                    <p className="font-heading font-bold text-xs">{fm.team_a}</p>
                  </div>
                  <div className="px-3 py-1.5 bg-primary/10 rounded-xl mx-2">
                    <span className="font-heading font-black text-primary text-sm">VS</span>
                  </div>
                  <div className="text-center flex-1">
                    <div className="text-2xl mb-1">{fm.flag_b}</div>
                    <p className="font-heading font-bold text-xs">{fm.team_b}</p>
                  </div>
                </div>

                {/* Odds */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-secondary/50 rounded-xl p-2 text-center border border-border/30 hover:border-primary/30 transition-colors cursor-pointer">
                    <p className="text-[10px] text-muted-foreground">{fm.team_a}</p>
                    <p className="font-heading font-bold text-primary text-sm">{fm.odds_a}x</p>
                  </div>
                  <div className="bg-secondary/50 rounded-xl p-2 text-center border border-border/30 hover:border-accent/30 transition-colors cursor-pointer">
                    <p className="text-[10px] text-muted-foreground">{fm.team_b}</p>
                    <p className="font-heading font-bold text-accent text-sm">{fm.odds_b}x</p>
                  </div>
                </div>

                {/* Pool */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Pool</span>
                  <span className="font-heading font-bold text-xs text-foreground">{fm.pool}</span>
                </div>

                <Link to="/matches">
                  <Button className="w-full mt-3 h-9 text-xs font-heading font-bold bg-primary/10 hover:bg-primary/20 text-primary rounded-xl border border-primary/20">
                    Bet Now →
                  </Button>
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── WORLD CUP PHOTO GRID ── */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-4 h-4 text-accent" />
          <h2 className="font-heading font-bold text-lg">World Cup 2026</h2>
          <span className="text-xs text-muted-foreground ml-1">USA · Canada · Mexico</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { src: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=600&q=80', label: 'Group Stage' },
            { src: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=600&q=80', label: 'Best Moments' },
            { src: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&q=80', label: 'Quarter Finals' },
            { src: 'https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?w=600&q=80', label: 'The Final' },
          ].map((photo, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.35 + i * 0.07 }}
              className="relative rounded-2xl overflow-hidden aspect-square group cursor-pointer"
            >
              <img src={photo.src} alt={photo.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute bottom-2 left-2 right-2">
                <p className="text-white font-heading font-bold text-xs">{photo.label}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ── LIVE MATCHES ── */}
      {liveMatches.length > 0 && (
        <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center gap-1.5 bg-destructive/10 px-3 py-1 rounded-full border border-destructive/20">
              <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
              <span className="text-xs font-bold text-destructive">LIVE NOW</span>
            </div>
            <h2 className="font-heading font-bold text-lg">Live Matches</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {liveMatches.map((m, i) => (
              <MatchCard key={m.id} match={m} bet={betByMatch[m.id]} index={i} />
            ))}
          </div>
        </motion.section>
      )}

      {/* ── OPEN BETS ── */}
      {openBets.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h2 className="font-heading font-bold text-lg">Open Bets</h2>
              <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full">{openBets.length}</span>
            </div>
            <Link to="/matches" className="flex items-center gap-1 text-xs text-primary hover:underline font-medium">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
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

      {/* ── UPCOMING ── */}
      {upcomingMatches.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-heading font-bold text-lg">Upcoming Matches</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingMatches.slice(0, 6).map((m, i) => (
              <MatchCard key={m.id} match={m} bet={betByMatch[m.id]} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* ── BOTTOM CTA BANNER ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/20 via-card to-accent/10 border border-primary/20 p-8 text-center"
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-primary/10 blur-3xl rounded-full" />
        <div className="relative z-10">
          <div className="text-4xl mb-3">🏆⚽🌍</div>
          <h2 className="font-heading font-black text-2xl md:text-3xl mb-2">
            48 Teams. 104 Matches. <span className="text-primary">One Champion.</span>
          </h2>
          <p className="text-muted-foreground text-sm mb-5 max-w-md mx-auto">
            Join thousands of bettors on the most decentralized sports betting platform — built on Solana for speed, transparency, and zero fees to the house.
          </p>
          <Link to="/matches">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-heading font-bold px-10 h-12 rounded-xl text-sm shadow-[0_0_30px_hsl(45,100%,51%,0.25)]">
              <Trophy className="w-4 h-4 mr-2" />
              Start Betting Now
            </Button>
          </Link>
        </div>
      </motion.div>

    </div>
  );
}