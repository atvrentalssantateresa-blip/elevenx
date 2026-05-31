import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { ArrowLeft, Clock, CheckCircle2, XCircle, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import OddsBar from '@/components/betting/OddsBar';
import BetSlip from '@/components/betting/BetSlip';

export default function BetDetail() {
  const { betId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedOutcome, setSelectedOutcome] = useState(null);

  const { data: bet } = useQuery({
    queryKey: ['bet', betId],
    queryFn: () => base44.entities.Bet.list().then(bets => bets.find(b => b.id === betId)),
    enabled: !!betId,
  });

  const { data: match } = useQuery({
    queryKey: ['match', bet?.match_id],
    queryFn: () => base44.entities.Match.list().then(ms => ms.find(m => m.id === bet.match_id)),
    enabled: !!bet?.match_id,
  });

  const { data: myBets = [] } = useQuery({
    queryKey: ['myBetsForBet', betId],
    queryFn: () => base44.entities.UserBet.filter({ bet_id: betId }),
    enabled: !!betId,
  });

  const myBet = myBets.find(ub => ub.created_by_id === user?.id);

  const placeBetMutation = useMutation({
    mutationFn: async (amount) => {
      // Create user bet
      await base44.entities.UserBet.create({
        bet_id: betId,
        match_id: bet.match_id,
        outcome: selectedOutcome,
        amount,
        outcome_label: selectedOutcome === 'a' ? bet.outcome_a : bet.outcome_b,
        match_title: `${match?.team_a} vs ${match?.team_b}`,
        status: 'active',
      });

      // Update bet totals
      const updates = {
        total_pool: (bet.total_pool || 0) + amount,
        total_bettors: (bet.total_bettors || 0) + 1,
      };
      if (selectedOutcome === 'a') {
        updates.total_a = (bet.total_a || 0) + amount;
      } else {
        updates.total_b = (bet.total_b || 0) + amount;
      }
      await base44.entities.Bet.update(betId, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bet', betId] });
      queryClient.invalidateQueries({ queryKey: ['myBetsForBet', betId] });
      queryClient.invalidateQueries({ queryKey: ['bets'] });
      toast({ title: 'Bet placed!', description: 'Your bet has been recorded successfully.' });
      setSelectedOutcome(null);
    },
    onError: (err) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const claimMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.UserBet.update(myBet.id, { status: 'claimed' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myBetsForBet', betId] });
      toast({ title: 'Claimed!', description: `$${myBet.actual_payout?.toFixed(2)} has been credited.` });
    },
  });

  if (!bet || !match) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const isOpen = bet.status === 'open' && new Date(bet.open_until) > new Date();
  const isSettled = bet.status === 'settled';

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Link to="/matches" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to matches
      </Link>

      {/* Match header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border/50 rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-muted-foreground">{match.group_stage || 'World Cup 2026'}</span>
          <Badge className={`text-[10px] uppercase tracking-wider ${
            bet.status === 'open' ? 'bg-accent/20 text-accent' :
            bet.status === 'settled' ? 'bg-primary/20 text-primary' :
            'bg-secondary text-secondary-foreground'
          }`}>
            {bet.status}
          </Badge>
        </div>

        <div className="flex items-center justify-between gap-6">
          <div className="flex-1 text-center">
            <div className="text-4xl mb-2">{match.team_a_flag || '🏳️'}</div>
            <p className="font-heading font-bold">{match.team_a}</p>
          </div>
          <div className="text-center">
            {match.status === 'finished' || match.status === 'live' ? (
              <div className="flex items-center gap-3">
                <span className="text-3xl font-heading font-bold">{match.score_a ?? 0}</span>
                <span className="text-muted-foreground">-</span>
                <span className="text-3xl font-heading font-bold">{match.score_b ?? 0}</span>
              </div>
            ) : (
              <span className="text-sm font-bold text-primary bg-primary/10 px-4 py-2 rounded-full">VS</span>
            )}
          </div>
          <div className="flex-1 text-center">
            <div className="text-4xl mb-2">{match.team_b_flag || '🏳️'}</div>
            <p className="font-heading font-bold">{match.team_b}</p>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-border/30 flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {bet.open_until ? `Closes ${format(new Date(bet.open_until), 'MMM d · HH:mm')}` : 'No deadline'}
          </span>
        </div>
      </motion.div>

      {/* Odds */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card border border-border/50 rounded-2xl p-6"
      >
        <h3 className="font-heading font-bold text-sm mb-4">Odds Distribution</h3>
        <OddsBar
          totalA={bet.total_a}
          totalB={bet.total_b}
          labelA={bet.outcome_a}
          labelB={bet.outcome_b}
          selected={selectedOutcome}
          onSelect={isOpen && !myBet ? setSelectedOutcome : () => {}}
        />
      </motion.div>

      {/* My existing bet */}
      {myBet && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-card border border-primary/20 rounded-2xl p-5"
        >
          <h3 className="font-heading font-bold text-sm mb-3 flex items-center gap-2">
            {myBet.status === 'won' || myBet.status === 'claimed' ? (
              <CheckCircle2 className="w-4 h-4 text-accent" />
            ) : myBet.status === 'lost' ? (
              <XCircle className="w-4 h-4 text-destructive" />
            ) : (
              <Trophy className="w-4 h-4 text-primary" />
            )}
            Your Bet
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Pick</p>
              <p className="font-bold text-primary">{myBet.outcome_label}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Stake</p>
              <p className="font-bold">${myBet.amount?.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Status</p>
              <Badge className={`text-[10px] ${
                myBet.status === 'won' ? 'bg-accent/20 text-accent' :
                myBet.status === 'lost' ? 'bg-destructive/20 text-destructive' :
                myBet.status === 'claimed' ? 'bg-primary/20 text-primary' :
                'bg-secondary text-secondary-foreground'
              }`}>
                {myBet.status}
              </Badge>
            </div>
            {(myBet.status === 'won' || myBet.status === 'claimed') && (
              <div>
                <p className="text-muted-foreground text-xs">Payout</p>
                <p className="font-bold text-accent">${myBet.actual_payout?.toFixed(2)}</p>
              </div>
            )}
          </div>

          {myBet.status === 'won' && (
            <Button
              onClick={() => claimMutation.mutate()}
              disabled={claimMutation.isPending}
              className="w-full mt-4 bg-accent hover:bg-accent/90 text-accent-foreground font-heading font-bold h-11 rounded-xl"
            >
              Claim ${myBet.actual_payout?.toFixed(2)}
            </Button>
          )}
        </motion.div>
      )}

      {/* Bet Slip */}
      {isOpen && !myBet && selectedOutcome && (
        <BetSlip
          bet={bet}
          selectedOutcome={selectedOutcome}
          onPlaceBet={(amount) => placeBetMutation.mutate(amount)}
          isPlacing={placeBetMutation.isPending}
        />
      )}

      {!isOpen && !myBet && (
        <div className="text-center py-8 bg-card border border-border/50 rounded-2xl">
          <p className="text-muted-foreground text-sm">
            {isSettled ? 'This bet has been settled.' : 'Betting is closed for this match.'}
          </p>
        </div>
      )}
    </div>
  );
}