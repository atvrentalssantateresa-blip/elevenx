import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Flame, Zap, TrendingUp, ArrowUpRight, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function GroupCountryCard({ market, onSelect }) {
  const [hoveredOutcome, setHoveredOutcome] = useState(null);
  const outcomes = market.outcomes || [];
  const firstPlace = outcomes.find(o => o.position === '1st');
  const secondPlace = outcomes.find(o => o.position === '2nd');
  const thirdPlace = outcomes.find(o => o.position === '3rd');

  const totalPool = outcomes.reduce((sum, o) => sum + (o.pool || 0), 0);
  const totalLpOffers = outcomes.reduce((sum, o) => sum + (o.lp_offers || 0), 0);

  const isOpen = market.status === 'open';
  const hasLiquidity = totalLpOffers > 0;
  const isHot = totalPool > 50;

  const getCardGradient = () => {
    if (!isOpen) return 'linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%)';
    if (totalPool > 100) return 'linear-gradient(135deg, #1a0a2e 0%, #0f1a2e 50%, #0a1a1a 100%)';
    if (totalPool > 50) return 'linear-gradient(135deg, #1a0a1e 0%, #1a0f2e 50%, #0a1a2e 100%)';
    return 'linear-gradient(135deg, #1a1a2e 0%, #0f0f1a 100%)';
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, rotate: -1 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      whileHover={{ scale: 1.04, rotate: 1, y: -8 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`relative rounded-[2rem] overflow-hidden cursor-pointer group/card`}
      style={{
        background: getCardGradient(),
        boxShadow: isOpen && hasLiquidity
          ? '0 12px 48px rgba(33,196,93,0.2), 0 0 0 1px rgba(33,196,93,0.1), inset 0 1px 2px rgba(255,255,255,0.1)'
          : '0 8px 32px rgba(0,0,0,0.5)'
      }}
    >
      {isOpen && (
        <>
          <div className="absolute inset-0 opacity-30 group-hover/card:opacity-50 transition-opacity duration-500">
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-emerald-500/20 to-transparent rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-primary/20 to-transparent rounded-full blur-3xl" />
          </div>
          
          <motion.div
            initial={{ top: '0%' }}
            animate={{ top: '100%' }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent"
          />
        </>
      )}

      <div className="relative p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <motion.div 
              className="relative"
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              {isOpen && (
                <motion.div
                  className="absolute inset-0 rounded-full"
                  animate={{ 
                    boxShadow: [
                      '0 0 0 0px rgba(33,196,93,0.4)',
                      '0 0 0 12px rgba(33,196,93,0)',
                    ]
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
              <div className={`relative w-16 h-16 rounded-2xl border-2 flex items-center justify-center text-4xl shadow-2xl overflow-hidden ${
                isOpen 
                  ? 'bg-gradient-to-br from-white/10 to-white/5 border-emerald-500/50 backdrop-blur-sm' 
                  : 'bg-gradient-to-br from-gray-500/20 to-gray-600/20 border-gray-500/30 grayscale'
              }`}>
                <div className={`absolute inset-0 ${
                  isOpen ? 'bg-emerald-500/10' : 'bg-gray-500/10'
                }`} />
                <span className="relative filter drop-shadow-lg">{market.country_flag || '🏳️'}</span>
              </div>
            </motion.div>
            
            <div>
              <h3 className={`font-heading font-black text-xl tracking-tight ${
                isOpen ? 'text-white' : 'text-white/40'
              }`}>
                {market.country}
              </h3>
              <div className="flex items-center gap-2 mt-1.5">
                {isOpen ? (
                  <Badge className="text-[7px] bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 text-emerald-400 border border-emerald-500/40 font-bold px-2 py-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1.5" />
                    LIVE
                  </Badge>
                ) : (
                  <Badge className="text-[7px] bg-gray-500/20 text-gray-400 border border-gray-500/30 px-2 py-0.5">
                    <Lock className="w-2 h-2 mr-1" />
                    SOON
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {isHot && isOpen && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 400, delay: 0.2 }}
            >
              <div className="flex items-center gap-1.5 bg-gradient-to-r from-orange-500/25 to-red-500/25 border border-orange-500/40 px-2.5 py-1.5 rounded-full">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  <Flame className="w-3.5 h-3.5 text-orange-400" />
                </motion.div>
                <span className="text-[7px] font-black text-orange-400 tracking-wider">HOT</span>
              </div>
            </motion.div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2.5 mb-4">
          {[
            { place: firstPlace, position: '1st', emoji: '🥇', label: 'WIN', color: 'yellow', glow: '#eab308' },
            { place: secondPlace, position: '2nd', emoji: '🥈', label: 'PLACE', color: 'slate', glow: '#94a3b8' },
            { place: thirdPlace, position: '3rd', emoji: '🥉', label: 'SHOW', color: 'amber', glow: '#d97706' }
          ].map(({ place, position, emoji, label, color, glow }) => (
            <motion.button
              key={position}
              onClick={() => isOpen && place && onSelect(market, place)}
              disabled={!isOpen || !place}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: isOpen && place ? 1 : 0.4, y: 0 }}
              whileHover={isOpen && place ? { scale: 1.08, y: -4 } : {}}
              whileTap={isOpen && place ? { scale: 0.95 } : {}}
              onMouseEnter={() => setHoveredOutcome(position)}
              onMouseLeave={() => setHoveredOutcome(null)}
              className={`relative overflow-hidden rounded-2xl p-3 border-2 transition-all duration-300 ${
                isOpen && place
                  ? `border-${color}-500/40 bg-gradient-to-br from-${color}-500/10 via-${color}-500/5 to-transparent hover:border-${color}-400`
                  : 'border-border/20 bg-secondary/10'
              }`}
            >
              {hoveredOutcome === position && (
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ duration: 0.5 }}
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                />
              )}
              
              <div className="relative">
                <motion.div
                  className="text-2xl mb-1"
                  animate={hoveredOutcome === position ? { rotate: [0, -10, 10, 0] } : {}}
                >
                  {emoji}
                </motion.div>
                
                <div className={`text-[7px] font-black uppercase tracking-wider mb-1.5 ${
                  hoveredOutcome === position ? `text-${color}-400` : `text-${color}-400/70`
                }`}>
                  {label}
                </div>
                
                <div className={`font-heading font-black text-xl ${
                  hoveredOutcome === position ? `text-${color}-400` : `text-${color}-400/80`
                } drop-shadow-lg`}>
                  {place?.odds ? `${place.odds.toFixed(2)}x` : '--'}
                </div>
                
                {place?.pool > 0 && (
                  <div className={`text-[6px] mt-1 ${
                    hoveredOutcome === position ? `text-${color}-400/80` : `text-${color}-400/50`
                  }`}>
                    ◎{(place.pool / 1000).toFixed(1)}K
                  </div>
                )}
              </div>
            </motion.button>
          ))}
        </div>

        <motion.div 
          className={`rounded-2xl p-4 border transition-all duration-300 ${
            hasLiquidity && isOpen
              ? 'bg-gradient-to-br from-emerald-500/15 via-primary/10 to-purple-500/15 border-emerald-500/30'
              : 'bg-secondary/10 border-border/20'
          }`}
          whileHover={hasLiquidity && isOpen ? { scale: 1.02 } : {}}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <motion.div 
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  hasLiquidity && isOpen ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/20' : 'bg-secondary/50'
                }`}
                whileHover={hasLiquidity && isOpen ? { rotate: 360 } : {}}
              >
                <TrendingUp className={`w-5 h-5 ${
                  hasLiquidity && isOpen ? 'text-emerald-400' : 'text-muted-foreground'
                }`} />
              </motion.div>
              <div>
                <p className="text-[7px] text-muted-foreground uppercase tracking-widest font-bold">Total Pool</p>
                <p className={`font-heading font-black text-xl ${
                  hasLiquidity && isOpen ? 'text-emerald-400' : 'text-muted-foreground'
                }`}>
                  ◎{(totalPool / 1000).toFixed(2)}K
                </p>
              </div>
            </div>

            <div className="text-right">
              <p className="text-[7px] text-muted-foreground uppercase tracking-widest font-bold">LP Stakes</p>
              <p className={`font-heading font-bold text-xl flex items-center gap-1.5 ${
                hasLiquidity && isOpen ? 'text-primary' : 'text-muted-foreground'
              }`}>
                <Star className="w-4 h-4" />
                {totalLpOffers}
              </p>
            </div>
          </div>

          {hasLiquidity && isOpen && (
            <div className="relative h-3 bg-secondary/50 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (totalPool / 100) * 100)}%` }}
                transition={{ duration: 1, delay: 0.3 }}
                className="h-full bg-gradient-to-r from-emerald-400 via-primary to-purple-500 rounded-full"
              >
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                />
              </motion.div>
            </div>
          )}
        </motion.div>

        {isHot && isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, type: "spring" }}
            className="mt-4 bg-gradient-to-r from-orange-500/20 via-red-500/20 to-orange-500/20 border border-orange-500/40 rounded-2xl p-3"
          >
            <div className="flex items-center gap-2.5">
              <motion.div animate={{ rotate: [0, 15, -15, 0] }}>
                <Zap className="w-5 h-5 text-orange-400" />
              </motion.div>
              <p className="text-[8px] font-black text-orange-400 uppercase tracking-wider">
                🔥 {Math.floor(totalPool / 10)} bets in last hour
              </p>
              <ArrowUpRight className="w-4 h-4 text-orange-400 ml-auto" />
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}