import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Zap, Globe, TrendingUp, Droplets } from 'lucide-react';
import { getTeamFlag } from '@/utils/flags';
import { Badge } from '@/components/ui/badge';
import BetCountdown from '@/components/betting/BetCountdown';

export default function MatchLiquidityCard({ bet, match, isSelected, onClick }) {
  if (!bet || !match) return null;

  const oddsA = bet.odds_a || bet.oracle_odds_a || 2.0;
  const oddsB = bet.odds_b || bet.oracle_odds_b || 3.0;
  const oddsDraw = bet.odds_draw || bet.oracle_odds_draw || 3.2;

  const totalPool = bet.total_pool || 0;

  return (
    <motion.button
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -6 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-full text-left"
    >
      <div className="relative bg-gradient-to-br from-card via-card to-primary/5 border border-primary/20 rounded-2xl overflow-hidden hover:border-primary/40 transition-all duration-300">
        {/* Header */}
        <div className="p-5 pb-3">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              {/* Enhanced Match Display */}
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full" />
                <div className="relative bg-gradient-to-br from-primary/20 to-primary/10 border-2 border-primary/40 rounded-xl p-2.5">
                  <span className="text-2xl font-heading font-black text-primary">VS</span>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <Badge className="text-[9px] bg-primary/10 text-primary border border-primary/20">
                    <TrendingUp className="w-2 h-2 mr-1" />
                    Match Bet
                  </Badge>
                  {totalPool > 0 && (
                    <Badge className="text-[9px] bg-accent/10 text-accent border border-accent/20">
                      <Droplets className="w-2.5 h-2.5 mr-1" />
                      LP Active
                    </Badge>
                  )}
                </div>
                <h3 className="font-heading font-bold text-sm text-primary/90">
                  {match.team_a} vs {match.team_b}
                </h3>
                <p className="text-xs text-muted-foreground">{match.group_stage || 'World Cup 2026'}</p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] text-muted-foreground flex items-center justify-end gap-1">
                <Droplets className="w-2.5 h-2.5 text-primary" />
                Pool
              </p>
              <p className="font-heading font-black text-lg bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                ◎{totalPool.toFixed(2)}
              </p>
              <p className="text-[9px] text-muted-foreground mt-0.5">
                Total liquidity
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-primary" />
              Fixed odds
            </div>
            <div className="flex items-center gap-1">
              <Globe className="w-3 h-3" />
              On-chain
            </div>
            <BetCountdown openUntil={bet.open_until} />
          </div>
        </div>

        {/* Outcomes grid */}
        <div className="px-5 pb-2">
          {/* Pool Summary */}
          <div className="mb-4 bg-gradient-to-br from-primary/10 via-primary/5 to-accent/5 border border-primary/20 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-primary flex items-center gap-1.5">
                <Droplets className="w-3.5 h-3.5" />
                Liquidity Pool
              </p>
              <Badge className="text-[9px] bg-primary/10 text-primary border border-primary/20">
                3 Outcomes
              </Badge>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-heading font-black bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                  ◎{totalPool.toFixed(2)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Total liquidity across all outcomes
                </p>
              </div>
            </div>
            {/* Visual pool meter */}
            <div className="mt-2 h-2.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary via-primary/80 to-primary/60 rounded-full transition-all shadow-lg shadow-primary/30"
                style={{ width: `${Math.min(100, (totalPool / 50) * 100)}%` }}
              />
            </div>
          </div>

          {/* Individual Outcome Cards */}
          <div className="grid grid-cols-3 gap-2">
            {/* Team A */}
            <div
              className={`flex flex-col p-3 rounded-xl border-2 transition-all relative overflow-hidden ${
                isSelected
                  ? 'border-primary bg-primary/10'
                  : 'border-primary/30 bg-primary/5 hover:border-primary/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`relative shrink-0 ${isSelected ? 'scale-110' : ''} transition-transform`}>
                  <div className="absolute inset-0 bg-primary/30 blur-md rounded-full" />
                  <div className="relative bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/40 rounded-lg p-1.5">
                    <span className="text-xl filter drop-shadow-md">
                      {getTeamFlag(match.team_a, match.team_a_flag)}
                    </span>
                  </div>
                </div>
                <span className={`font-heading font-bold text-xs truncate ${isSelected ? 'text-primary' : ''}`}>
                  {match.team_a.split(' ').pop()}
                </span>
              </div>

              <div className="w-full mt-auto">
                <div className="flex justify-between items-center mb-1">
                  <p className={`font-heading font-black text-lg ${isSelected ? 'text-primary' : 'text-foreground'} drop-shadow`}>
                    {oddsA.toFixed(2)}x
                  </p>
                  <Badge className="text-[8px] bg-primary/10 text-primary border border-primary/20">
                    ◎{(bet.pool_a || 0).toFixed(1)}
                  </Badge>
                </div>

                {/* Mini pool progress */}
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full transition-all"
                    style={{ width: `${totalPool > 0 ? ((bet.pool_a || 0) / totalPool) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Draw */}
            <div
              className={`flex flex-col p-3 rounded-xl border-2 transition-all relative overflow-hidden ${
                isSelected
                  ? 'border-primary bg-primary/10'
                  : 'border-yellow-500/30 bg-yellow-500/5 hover:border-yellow-500/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`relative shrink-0 ${isSelected ? 'scale-110' : ''} transition-transform`}>
                  <div className="absolute inset-0 bg-yellow-500/30 blur-md rounded-full" />
                  <div className="relative bg-gradient-to-br from-yellow-400/20 to-yellow-600/20 border border-yellow-500/40 rounded-lg p-1.5">
                    <span className="text-xl filter drop-shadow-md">🤝</span>
                  </div>
                </div>
                <span className={`font-heading font-bold text-xs truncate ${isSelected ? 'text-yellow-400' : ''}`}>
                  Draw
                </span>
              </div>

              <div className="w-full mt-auto">
                <div className="flex justify-between items-center mb-1">
                  <p className={`font-heading font-black text-lg ${isSelected ? 'text-yellow-400' : 'text-foreground'} drop-shadow`}>
                    {oddsDraw.toFixed(2)}x
                  </p>
                  <Badge className="text-[8px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                    ◎{(bet.pool_draw || 0).toFixed(1)}
                  </Badge>
                </div>

                {/* Mini pool progress */}
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full transition-all"
                    style={{ width: `${totalPool > 0 ? ((bet.pool_draw || 0) / totalPool) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Team B */}
            <div
              className={`flex flex-col p-3 rounded-xl border-2 transition-all relative overflow-hidden ${
                isSelected
                  ? 'border-primary bg-primary/10'
                  : 'border-accent/30 bg-accent/5 hover:border-accent/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`relative shrink-0 ${isSelected ? 'scale-110' : ''} transition-transform`}>
                  <div className="absolute inset-0 bg-accent/30 blur-md rounded-full" />
                  <div className="relative bg-gradient-to-br from-accent/20 to-accent/10 border border-accent/40 rounded-lg p-1.5">
                    <span className="text-xl filter drop-shadow-md">
                      {getTeamFlag(match.team_b, match.team_b_flag)}
                    </span>
                  </div>
                </div>
                <span className={`font-heading font-bold text-xs truncate ${isSelected ? 'text-accent' : ''}`}>
                  {match.team_b.split(' ').pop()}
                </span>
              </div>

              <div className="w-full mt-auto">
                <div className="flex justify-between items-center mb-1">
                  <p className={`font-heading font-black text-lg ${isSelected ? 'text-accent' : 'text-foreground'} drop-shadow`}>
                    {oddsB.toFixed(2)}x
                  </p>
                  <Badge className="text-[8px] bg-accent/10 text-accent border border-accent/20">
                    ◎{(bet.pool_b || 0).toFixed(1)}
                  </Badge>
                </div>

                {/* Mini pool progress */}
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-accent to-emerald-400 rounded-full transition-all"
                    style={{ width: `${totalPool > 0 ? ((bet.pool_b || 0) / totalPool) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Selected preview */}
        {isSelected && (
          <div className="mx-5 mb-5 bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-primary" />
              <p className="text-xs font-bold text-primary">Provide Liquidity</p>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Selected outcome</span>
              <span className="font-bold">All 3 outcomes</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Fixed odds</span>
              <span className="font-bold text-primary">
                {oddsA.toFixed(2)}x / {oddsDraw.toFixed(2)}x / {oddsB.toFixed(2)}x
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Available liquidity</span>
              <span className="font-bold text-accent">
                ◎{totalPool.toFixed(2)}
              </span>
            </div>
            <div className="h-px bg-border/30 my-1" />
            <p className="text-[10px] text-muted-foreground text-center">
              Select an outcome above to provide liquidity
            </p>
          </div>
        )}
      </div>
    </motion.button>
  );
}