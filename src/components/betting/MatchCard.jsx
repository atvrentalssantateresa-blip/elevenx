import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, MapPin, Users, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

const statusStyles = {
  upcoming: 'bg-secondary text-secondary-foreground',
  live: 'bg-destructive/20 text-destructive border border-destructive/30',
  finished: 'bg-muted text-muted-foreground',
  cancelled: 'bg-muted text-muted-foreground line-through',
};

export default function MatchCard({ match, bet, index = 0 }) {
  const matchTime = match.match_time ? new Date(match.match_time) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
    >
      <Link
        to={bet ? `/bet/${bet.id}` : `/matches`}
        className="group block"
      >
        <div className="relative bg-card border border-border/50 rounded-2xl p-5 hover:border-primary/30 transition-all duration-300 hover:shadow-[0_0_30px_-10px_hsl(45,100%,51%,0.15)]">
          {/* Status badge */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-muted-foreground font-medium">
              {match.group_stage || 'World Cup 2026'}
            </span>
            <Badge className={`text-[10px] font-semibold uppercase tracking-wider ${statusStyles[match.status] || statusStyles.upcoming}`}>
              {match.status === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse mr-1.5" />}
              {match.status}
            </Badge>
          </div>

          {/* Teams */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 text-center">
              <div className="text-3xl mb-2">{match.team_a_flag || '🏳️'}</div>
              <p className="font-heading font-bold text-sm text-foreground truncate">{match.team_a}</p>
            </div>

            <div className="flex flex-col items-center gap-1">
              {match.status === 'finished' || match.status === 'live' ? (
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-heading font-bold text-foreground">{match.score_a ?? 0}</span>
                  <span className="text-muted-foreground text-sm">-</span>
                  <span className="text-2xl font-heading font-bold text-foreground">{match.score_b ?? 0}</span>
                </div>
              ) : (
                <span className="text-xs font-semibold text-primary px-3 py-1.5 bg-primary/10 rounded-full">
                  VS
                </span>
              )}
              {matchTime && (
                <span className="text-[10px] text-muted-foreground mt-1">
                  {format(matchTime, 'MMM d · HH:mm')}
                </span>
              )}
            </div>

            <div className="flex-1 text-center">
              <div className="text-3xl mb-2">{match.team_b_flag || '🏳️'}</div>
              <p className="font-heading font-bold text-sm text-foreground truncate">{match.team_b}</p>
            </div>
          </div>

          {/* Bet info */}
          {bet && (
            <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {bet.total_bettors || 0} bettors
                </span>
                <span className="font-medium text-foreground">
                  Pool: ${(bet.total_pool || 0).toLocaleString()}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          )}

          {/* Venue */}
          {match.venue && (
            <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
              <MapPin className="w-3 h-3" />
              {match.venue}
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}