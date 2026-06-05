import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getTeamFlag } from '@/utils/flags';

const statusStyles = {
  open: 'bg-accent/10 text-accent border border-accent/20',
  coming_soon: 'bg-secondary text-secondary-foreground',
  closed: 'bg-muted text-muted-foreground',
  settled: 'bg-muted text-muted-foreground'
};

export default function FuturesCard({ market, index }) {
  const totalPool = market.outcomes.reduce((sum, o) => sum + (o.pool || 0), 0);
  const topOutcome = market.outcomes.reduce((max, o) => o.odds > (max?.odds || 0) ? o : max, null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
    >
      <Link to={`/futures`} className="group block">
        <div className="relative rounded-2xl p-4 transition-all duration-300 border border-primary/20 h-full bg-[#262322]">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-muted-foreground font-semibold truncate">
              {market.category === 'tournament' ? 'Tournament Futures' : market.category === 'player' ? 'Player Markets' : 'Special'}
            </span>
            <Badge className={`text-[9px] font-semibold uppercase tracking-wider flex-shrink-0 ${statusStyles[market.status] || statusStyles.open}`}>
              {market.status === 'open' && <span className="w-1 h-1 rounded-full bg-accent animate-pulse mr-1" />}
              {market.status.replace('_', ' ')}
            </Badge>
          </div>

          {/* Country/Market Info */}
          <div className="flex items-center justify-between gap-2 mb-3">
            {/* Country Icon */}
            <div className="flex-1 text-center">
              <div className="text-3xl mb-1">{market.icon || '🏆'}</div>
              <p className="text-[10px] text-foreground truncate font-medium">{market.country}</p>
            </div>

            {/* VS Divider */}
            <div className="flex flex-col items-center gap-1 px-2 flex-shrink-0">
              <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">VS</span>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Trophy className="w-3 h-3" />
                <span>{market.outcomes.length} outcomes</span>
              </div>
            </div>

            {/* Pool Info */}
            <div className="flex-1 text-center">
              <div className="text-2xl mb-1">💰</div>
              <p className="text-[10px] text-foreground truncate font-medium">◎{totalPool.toFixed(1)}</p>
            </div>
          </div>

          {/* Top Odds / Pool Info */}
          {topOutcome ? (
            <div className="pt-2.5 border-t border-border/50">
              <div className="grid grid-cols-2 gap-1.5 mb-2">
                <div className="rounded-lg px-1.5 py-1 text-center text-xs border bg-primary/10 border-primary/20">
                  <p className="text-[9px] text-muted-foreground truncate">Top Odds</p>
                  <p className="font-bold text-primary text-xs">{topOutcome.odds.toFixed(2)}x</p>
                </div>
                <div className="rounded-lg px-1.5 py-1 text-center text-xs border bg-accent/10 border-accent/20">
                  <p className="text-[9px] text-muted-foreground truncate">Liquidity</p>
                  <p className="font-bold text-accent text-xs">◎{topOutcome.pool.toFixed(1)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="truncate">{topOutcome.label}</span>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </div>
          ) : (
            <div className="pt-2.5 border-t border-border/30 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>No liquidity</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:text-primary transition-colors" />
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}