import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, TrendingDown, Clock, ChevronRight, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const statusConfig = {
  active:   { color: 'bg-primary/10 text-primary border-primary/20', icon: Clock },
  pending:  { color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', icon: Clock },
  won:      { color: 'bg-accent/20 text-accent border-accent/20', icon: TrendingUp },
  lost:     { color: 'bg-destructive/10 text-destructive border-destructive/20', icon: TrendingDown },
  claimed:  { color: 'bg-accent/20 text-accent border-accent/20', icon: Trophy },
  refunded: { color: 'bg-secondary text-secondary-foreground border-border', icon: Clock },
  void:     { color: 'bg-muted text-muted-foreground border-border', icon: Clock },
};

export default function MyBets() {
  const { user } = useAuth();

  const getWalletAddress = () => {
    const walletSession = localStorage.getItem('elevenx_wallet_session');
    if (walletSession) {
      try {
        const parsed = JSON.parse(walletSession);
        return parsed.address || parsed;
      } catch { return walletSession; }
    }
    return null;
  };
  const walletAddress = getWalletAddress();

  const { data: myBets = [], isLoading } = useQuery({
    queryKey: ['myBets', walletAddress, user?.id],
    queryFn: async () => {
      const all = await base44.entities.UserBet.list('-created_date', 100);
      if (walletAddress) return all.filter(ub => ub.wallet_address === walletAddress);
      if (user?.id) return all.filter(ub => ub.created_by_id === user.id);
      return [];
    },
    enabled: !!walletAddress || !!user,
  });

  const totalStaked = myBets.reduce((s, b) => s + (b.amount || 0), 0);
  const totalWon = myBets.filter(b => b.status === 'won' || b.status === 'claimed').reduce((s, b) => s + (b.actual_payout || 0), 0);
  const activeBets = myBets.filter(b => b.status === 'active' || b.status === 'pending');
  const completedBets = myBets.filter(b => b.status !== 'active' && b.status !== 'pending');

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="font-heading font-black text-2xl mb-1">My Bets</h1>
        <p className="text-sm text-muted-foreground">Track all your bets and winnings</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Staked', value: `◎${totalStaked.toFixed(2)}`, color: '' },
          { label: 'Total Won', value: `◎${totalWon.toFixed(2)}`, color: 'text-accent' },
          { label: 'Active', value: activeBets.length.toString(), color: 'text-primary' },
        ].map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-card border border-border/50 rounded-2xl p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{stat.label}</p>
            <p className={`font-heading font-bold text-xl ${stat.color}`}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {activeBets.length > 0 && (
        <section>
          <h2 className="font-heading font-bold text-sm mb-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" /> Active Bets
          </h2>
          <div className="space-y-2">
            {activeBets.map((bet, i) => <BetRow key={bet.id} bet={bet} index={i} walletAddress={walletAddress} />)}
          </div>
        </section>
      )}

      {completedBets.length > 0 && (
        <section>
          <h2 className="font-heading font-bold text-sm mb-3">History</h2>
          <div className="space-y-2">
            {completedBets.map((bet, i) => <BetRow key={bet.id} bet={bet} index={i} walletAddress={walletAddress} />)}
          </div>
        </section>
      )}

      {myBets.length === 0 && !isLoading && (
        <div className="text-center py-20">
          <Trophy className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No bets yet</p>
          <Link to="/matches" className="text-primary text-sm hover:underline mt-2 inline-block">Browse matches →</Link>
        </div>
      )}
    </div>
  );
}

function BetRow({ bet, index }) {
  const queryClient = useQueryClient();

  const config = statusConfig[bet.status] || statusConfig.active;
  const StatusIcon = config.icon;

  const claimMutation = useMutation({
    mutationFn: () => base44.functions.invoke('claimWinnings', { userBetId: bet.id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['myBets'] }),
    onError: (error) => alert('Claim failed: ' + (error.message || 'Unknown error')),
  });

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}>
      <div className="group flex items-center justify-between p-4 bg-card border border-border/50 rounded-xl">
        <Link to={`/match/${bet.match_id}`} className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${config.color}`}>
            <StatusIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="font-heading font-bold text-sm truncate">{bet.match_title || 'Match'}</p>
            <p className="text-xs text-muted-foreground">
              Backed: <span className="text-primary font-medium">{bet.outcome_label}</span> · ◎{bet.amount?.toFixed(4)}
            </p>
          </div>
        </Link>
        <div className="flex items-center gap-3 flex-shrink-0">
          {bet.status === 'won' ? (
            <>
              <span className="text-sm font-bold text-accent">◎{bet.potential_payout?.toFixed(4)}</span>
              <Button size="sm" onClick={() => claimMutation.mutate()} disabled={claimMutation.isPending}
                className="h-8 text-xs bg-accent hover:bg-accent/90 text-accent-foreground font-bold rounded-lg">
                {claimMutation.isPending ? (
                  <div className="w-4 h-4 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin" />
                ) : (
                  <><Wallet className="w-3 h-3 mr-1" />Claim</>
                )}
              </Button>
            </>
          ) : (
            <>
              {(bet.status === 'claimed') && (
                <span className="text-sm font-bold text-accent">◎{bet.actual_payout?.toFixed(4)}</span>
              )}
              <Badge className={`text-[10px] border ${config.color}`}>{bet.status}</Badge>
            </>
          )}
          <Link to={`/match/${bet.match_id}`}>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}