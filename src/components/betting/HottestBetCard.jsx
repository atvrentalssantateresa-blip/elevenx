import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Flame, ArrowRight, DollarSign, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getTeamFlag } from '@/utils/flags';

export default function HottestBetCard({ match, bet, index }) {
  if (!match || !bet) return null;

  const topPoolOutcome = (() => {
    const pools = [
      { label: bet.outcome_a, pool: bet.pool_a || 0 },
      { label: bet.outcome_b, pool: bet.pool_b || 0 },
      { label: bet.outcome_draw || 'Draw', pool: bet.pool_draw || 0 },
    ];
    return pools.reduce((max, curr) => curr.pool > max.pool ? curr : max, pools[0]);
  })();

  const totalPool = bet.total_pool || 0;
  const totalBettors = bet.total_bettors || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card hover:border-primary/40 transition-all duration-300"
      style={{
        background: 'linear-gradient(145deg, rgba(26,16,64,0.8) 0%, rgba(15,10,30,0.95) 100%)',
      }}
    >
      {/* Glow effect on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
        <div className="absolute top-0 right-0 w-20 h-20 bg-primary/20 blur-3xl rounded-full" />
        <div className="absolute bottom-0 left-0 w-16 h-16 bg-accent/15 blur-3xl rounded-full" />
      </div>

      {/* Hot badge */}
      <div className="absolute top-3 right-3 z-10">
        <div className="flex items-center gap-1 bg-destructive/20 backdrop-blur-sm border border-destructive/30 px-2 py-1 rounded-full">
          <Flame className="w-3 h-3 text-destructive" />
          <span className="text-[9px] font-black text-destructive uppercase tracking-wide">Hot</span>
        </div>
      </div>

      <Link to={`/bet/${bet.id}`} className="block p-2.5">
        {/* Teams */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex-1 text-center">
            <div className="text-3xl mb-0.5">{getTeamFlag(match.team_a)}</div>
            <p className="font-heading font-bold text-xs leading-tight truncate">{match.team_a}</p>
          </div>
          
          <div className="flex flex-col items-center gap-0.5 px-1.5">
            <span className="font-heading font-black text-base text-primary">VS</span>
            <div className="flex items-center gap-1 text-[8px] text-muted-foreground font-medium bg-secondary/50 px-1.5 py-0.5 rounded-lg">
              <DollarSign className="w-2 h-2" />
              {(totalPool || 0).toFixed(1)}
            </div>
          </div>

          <div className="flex-1 text-center">
            <div className="text-3xl mb-0.5">{getTeamFlag(match.team_b)}</div>
            <p className="font-heading font-bold text-xs leading-tight truncate">{match.team_b}</p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-1.5 mb-2.5">
          <div className="bg-secondary/30 backdrop-blur-sm border border-border/30 rounded-lg p-2">
            <div className="flex items-center gap-1 mb-0.5">
              <DollarSign className="w-2 h-2 text-muted-foreground" />
              <span className="text-[7px] text-muted-foreground font-medium uppercase">Pool</span>
            </div>
            <p className="font-heading font-bold text-sm">◎{totalPool.toFixed(2)}</p>
          </div>
          <div className="bg-secondary/30 backdrop-blur-sm border border-border/30 rounded-lg p-2">
            <div className="flex items-center gap-1 mb-0.5">
              <TrendingUp className="w-2 h-2 text-muted-foreground" />
              <span className="text-[7px] text-muted-foreground font-medium uppercase">Bettors</span>
            </div>
            <p className="font-heading font-bold text-sm">{totalBettors}</p>
          </div>
        </div>

        {/* CTA */}
        <div className="flex items-center justify-between pt-2 border-t border-border/30">
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[9px] font-bold text-green-500">Open</span>
          </div>
          <div className="flex items-center gap-0.5 text-primary font-bold text-[10px] group-hover:translate-x-0.5 transition-transform">
            Bet <ArrowRight className="w-2.5 h-2.5" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}