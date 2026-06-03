import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, Medal, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function GroupCountryCard({ market, onSelect }) {
  const outcomes = market.outcomes || [];
  const firstPlace = outcomes.find(o => o.position === '1st');
  const secondPlace = outcomes.find(o => o.position === '2nd');
  const thirdPlace = outcomes.find(o => o.position === '3rd');

  const totalPool = outcomes.reduce((sum, o) => sum + (o.pool || 0), 0);
  const totalLpOffers = outcomes.reduce((sum, o) => sum + (o.lp_offers || 0), 0);

  const isOpen = market.status === 'open';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      className="bg-card/80 backdrop-blur-sm border border-border/40 rounded-2xl p-4 hover:border-primary/30 transition-all"
    >
      {/* Country Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-accent/10 border-2 border-primary/30 flex items-center justify-center text-3xl shadow-lg">
          {market.country_flag || '🏳️'}
        </div>
        <div className="flex-1">
          <h3 className="font-heading font-bold text-base text-foreground">{market.country}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge className="text-[9px] bg-primary/15 text-primary border border-primary/25">
              {market.category === 'tournament' ? 'Tournament' : 'Group Stage'}
            </Badge>
            {isOpen ? (
              <span className="text-[9px] text-accent font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                Open
              </span>
            ) : (
              <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" />
                Coming Soon
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Multiplier Buttons - Side by Side */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {/* 1st Place */}
        <button
          onClick={() => isOpen && firstPlace && onSelect(market, firstPlace)}
          disabled={!isOpen || !firstPlace}
          className={`relative overflow-hidden rounded-xl p-2.5 border transition-all ${
            isOpen && firstPlace
              ? 'border-yellow-500/40 bg-gradient-to-br from-yellow-500/10 to-orange-500/5 hover:border-yellow-400 hover:from-yellow-500/15 hover:to-orange-500/10 cursor-pointer'
              : 'border-border/20 bg-secondary/20 opacity-50 cursor-not-allowed'
          }`}
        >
          <div className="text-center">
            <div className="text-xs mb-1">🥇 1st</div>
            <div className="font-heading font-black text-sm text-yellow-400">
              {firstPlace?.odds ? `${firstPlace.odds.toFixed(2)}x` : '--'}
            </div>
          </div>
          {isOpen && firstPlace && (
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/5 to-orange-400/5 pointer-events-none" />
          )}
        </button>

        {/* 2nd Place */}
        <button
          onClick={() => isOpen && secondPlace && onSelect(market, secondPlace)}
          disabled={!isOpen || !secondPlace}
          className={`relative overflow-hidden rounded-xl p-2.5 border transition-all ${
            isOpen && secondPlace
              ? 'border-slate-400/40 bg-gradient-to-br from-slate-400/10 to-gray-500/5 hover:border-slate-300 hover:from-slate-400/15 hover:to-gray-500/10 cursor-pointer'
              : 'border-border/20 bg-secondary/20 opacity-50 cursor-not-allowed'
          }`}
        >
          <div className="text-center">
            <div className="text-xs mb-1">🥈 2nd</div>
            <div className="font-heading font-black text-sm text-slate-300">
              {secondPlace?.odds ? `${secondPlace.odds.toFixed(2)}x` : '--'}
            </div>
          </div>
          {isOpen && secondPlace && (
            <div className="absolute inset-0 bg-gradient-to-br from-slate-400/5 to-gray-400/5 pointer-events-none" />
          )}
        </button>

        {/* 3rd Place */}
        <button
          onClick={() => isOpen && thirdPlace && onSelect(market, thirdPlace)}
          disabled={!isOpen || !thirdPlace}
          className={`relative overflow-hidden rounded-xl p-2.5 border transition-all ${
            isOpen && thirdPlace
              ? 'border-amber-600/40 bg-gradient-to-br from-amber-600/10 to-orange-700/5 hover:border-amber-500 hover:from-amber-600/15 hover:to-orange-700/10 cursor-pointer'
              : 'border-border/20 bg-secondary/20 opacity-50 cursor-not-allowed'
          }`}
        >
          <div className="text-center">
            <div className="text-xs mb-1">🥉 3rd</div>
            <div className="font-heading font-black text-sm text-amber-500">
              {thirdPlace?.odds ? `${thirdPlace.odds.toFixed(2)}x` : '--'}
            </div>
          </div>
          {isOpen && thirdPlace && (
            <div className="absolute inset-0 bg-gradient-to-br from-amber-600/5 to-orange-700/5 pointer-events-none" />
          )}
        </button>
      </div>

      {/* Pool Stats */}
      <div className="pt-3 border-t border-border/30 flex items-center justify-between">
        <div className="text-[9px] text-muted-foreground">
          <span className="font-bold text-primary">◎{(totalPool / 1000).toFixed(1)}K</span> pool
        </div>
        <div className="text-[9px] text-muted-foreground">
          <span className="font-bold text-accent">{totalLpOffers}</span> LP offers
        </div>
      </div>
    </motion.div>
  );
}