import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';

// Helper to convert country code to flag emoji
function getFlagEmoji(countryCode) {
  if (!countryCode) return '🏳️';
  const code = countryCode.toUpperCase();
  return code.split('').map(c => String.fromCodePoint(c.charCodeAt(0) + 127397)).join('');
}

/**
 * Fixed-odds outcome selector.
 * Shows live market odds from The Odds API for each outcome.
 */
export default function OddsBar({ bet, match, selected, onSelect, canSelect = true }) {
  const [liveOdds, setLiveOdds] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!match?.team_a || !match?.team_b) return;

    const fetchLiveOdds = async () => {
      try {
        setLoading(true);
        const res = await base44.functions.invoke('fetchTheOddsApi', {});
        const matches = res.data.matches || [];
        
        // Find matching teams in the response
        const matchedOdds = matches.find(m => 
          (m.home_team === match.team_a && m.away_team === match.team_b) ||
          (m.home_team === match.team_b && m.away_team === match.team_a)
        );
        
        if (matchedOdds) {
          setLiveOdds(matchedOdds.odds);
        }
      } catch (err) {
        console.error('Failed to fetch live odds:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLiveOdds();
  }, [match?.team_a, match?.team_b]);

  if (!bet) return null;

  const outcomes = [
    {
      key: 'a',
      label: bet.outcome_a,
      flag: getFlagEmoji(match?.team_a_flag),
      odds: liveOdds?.home || (bet.odds_a / 100),
      liquidity: bet.pool_a || 0,
      matched: bet.pool_a || 0,
      color: 'primary',
    },
    ...(bet.outcome_draw ? [{
      key: 'draw',
      label: bet.outcome_draw || 'Draw',
      flag: '🤝',
      odds: liveOdds?.draw || (bet.odds_draw / 100),
      liquidity: bet.pool_draw || 0,
      matched: bet.pool_draw || 0,
      color: 'yellow',
    }] : []),
    {
      key: 'b',
      label: bet.outcome_b,
      flag: getFlagEmoji(match?.team_b_flag),
      odds: liveOdds?.away || (bet.odds_b / 100),
      liquidity: bet.pool_b || 0,
      matched: bet.pool_b || 0,
      color: 'accent',
    },
  ];

  const colorMap = {
    primary: { border: 'border-primary', bg: 'bg-primary/5', text: 'text-primary', badge: 'bg-primary/10 text-primary' },
    accent:  { border: 'border-accent',  bg: 'bg-accent/5',  text: 'text-accent',  badge: 'bg-accent/10 text-accent' },
    yellow:  { border: 'border-yellow-500', bg: 'bg-yellow-500/5', text: 'text-yellow-400', badge: 'bg-yellow-500/10 text-yellow-400' },
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-3 flex-wrap">
        {outcomes.map((o) => {
          const c = colorMap[o.color];
          const odds = typeof o.odds === 'number' ? o.odds.toFixed(2) : '0.00';
          const available = (o.liquidity - o.matched).toFixed(2);
          const isSelected = selected === o.key;

          return (
            <button
              key={o.key}
              onClick={() => canSelect && onSelect(o.key)}
              disabled={!canSelect}
              className={`flex-1 min-w-[100px] p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                isSelected
                  ? `${c.border} ${c.bg} shadow-[0_0_20px_-5px_rgba(0,0,0,0.3)]`
                  : 'border-border/50 bg-card hover:border-border'
              } ${!canSelect ? 'opacity-60 cursor-default' : 'cursor-pointer'}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">{o.flag}</span>
                <p className="font-heading font-bold text-sm truncate">{o.label}</p>
              </div>

              {/* Fixed odds — the headline number */}
              <p className={`text-2xl font-heading font-black mt-1 ${isSelected ? c.text : 'text-foreground'}`}>
                {odds}x
              </p>

              {/* LP liquidity available */}
              <p className="text-[10px] text-muted-foreground mt-1">
                ◎{Number(available) > 0 ? available : '0'} available
              </p>

              {Number(available) <= 0 && (
                <span className="text-[9px] text-yellow-400 font-medium mt-0.5 block">⚠ No LP — bet pending</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Matched vs liquidity bars */}
      <div className="space-y-1.5">
        {outcomes.map((o) => {
          const pct = o.liquidity > 0 ? Math.min((o.matched / o.liquidity) * 100, 100) : 0;
          const c   = colorMap[o.color];
          return (
            <div key={o.key} className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="w-16 truncate">{o.label}</span>
              <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${
                    o.color === 'primary' ? 'bg-primary' : o.color === 'accent' ? 'bg-accent' : 'bg-yellow-500'
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </div>
              <span>{pct.toFixed(0)}% matched</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}