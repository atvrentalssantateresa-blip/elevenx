import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, TrendingDown, Clock, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const statusConfig = {
  active: { color: 'bg-primary/10 text-primary border-primary/20', icon: Clock },
  won: { color: 'bg-accent/20 text-accent border-accent/20', icon: TrendingUp },
  lost: { color: 'bg-destructive/10 text-destructive border-destructive/20', icon: TrendingDown },
  claimed: { color: 'bg-accent/20 text-accent border-accent/20', icon: Trophy },
  refunded: { color: 'bg-secondary text-secondary-foreground border-border', icon: Clock },
  void: { color: 'bg-muted text-muted-foreground border-border', icon: Clock },
};

export default function MyBets() {
  const { user } = useAuth();

  const { data: myBets = [], isLoading } = useQuery({
    queryKey: ['myBets'],
    queryFn: async () => {
      const all = await base44.entities.UserBet.list('-created_date', 100);
      return all.filter(ub => ub.created_by_id === user?.id);
    },
    enabled: !!user,
  });

  const totalStaked = myBets.reduce((s, b) => s + (b.amount || 0), 0);
  const totalWon = myBets.filter(b => b.status === 'won' || b.status === 'claimed').reduce((s, b) => s + (b.actual_payout || 0), 0);
  const activeBets = myBets.filter(b => b.status === 'active');
  const completedBets = myBets.filter(b => b.status !== 'active');

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="font-heading font-black text-2xl mb-1">My Bets</h1>
        <p className="text-sm text-muted-foreground">Track all your bets and winnings</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border/50 rounded-2xl p-4"
        >
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Total Staked</p>
          <p className="font-heading font-bold text-xl">${totalStaked.toLocaleString()}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-card border border-border/50 rounded-2xl p-4"
        >
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Total Won</p>
          <p className="font-heading font-bold text-xl text-accent">${totalWon.toLocaleString()}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border/50 rounded-2xl p-4"
        >
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Active</p>
          <p className="font-heading font-bold text-xl text-primary">{activeBets.length}</p>
        </motion.div>
      </div>

      {/* Active bets */}
      {activeBets.length > 0 && (
        <section>
          <h2 className="font-heading font-bold text-sm mb-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            Active Bets
          </h2>
          <div className="space-y-2">
            {activeBets.map((bet, i) => (
              <BetRow key={bet.id} bet={bet} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* Completed */}
      {completedBets.length > 0 && (
        <section>
          <h2 className="font-heading font-bold text-sm mb-3">History</h2>
          <div className="space-y-2">
            {completedBets.map((bet, i) => (
              <BetRow key={bet.id} bet={bet} index={i} />
            ))}
          </div>
        </section>
      )}

      {myBets.length === 0 && !isLoading && (
        <div className="text-center py-20">
          <Trophy className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No bets yet</p>
          <Link to="/matches" className="text-primary text-sm hover:underline mt-2 inline-block">
            Browse matches →
          </Link>
        </div>
      )}
    </div>
  );
}

function BetRow({ bet, index }) {
  const config = statusConfig[bet.status] || statusConfig.active;
  const StatusIcon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
    >
      <Link
        to={`/bet/${bet.bet_id}`}
        className="group flex items-center justify-between p-4 bg-card border border-border/50 rounded-xl hover:border-primary/30 transition-all"
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${config.color}`}>
            <StatusIcon className="w-4 h-4" />
          </div>
          <div>
            <p className="font-heading font-bold text-sm">{bet.match_title || 'Match'}</p>
            <p className="text-xs text-muted-foreground">
              Picked: <span className="text-primary font-medium">{bet.outcome_label}</span> · ${bet.amount?.toFixed(2)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={`text-[10px] border ${config.color}`}>
            {bet.status}
          </Badge>
          {(bet.status === 'won' || bet.status === 'claimed') && (
            <span className="text-sm font-bold text-accent">${bet.actual_payout?.toFixed(2)}</span>
          )}
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </Link>
    </motion.div>
  );
}