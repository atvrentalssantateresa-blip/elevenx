import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Plus, RefreshCw, CheckCircle2 } from 'lucide-react';
import SolanaTransactionSigner from '@/components/wallet/SolanaTransactionSigner';

export default function AdminMatchRow({ match, bets, index }) {
  const queryClient = useQueryClient();
  const existingBet = bets.find(b => b.match_id === match.id);
  const [pendingMarketInit, setPendingMarketInit] = useState(null);

  const { data: marketStatus } = useQuery({
    queryKey: ['marketStatus', match.id],
    queryFn: async () => {
      const res = await base44.functions.invoke('checkMarketStatus', { match_id: match.id });
      return res.data;
    },
    enabled: !!existingBet,
    refetchInterval: 10000,
  });

  const isMarketInitialized = existingBet?.solana_market_created || marketStatus?.status === 'initialized';

  const createBetMutation = useMutation({
    mutationFn: async () => {
      const bet = await base44.entities.Bet.create({
        match_id: match.id,
        title: `${match.team_a} vs ${match.team_b}`,
        outcome_a: match.team_a,
        outcome_b: match.team_b,
        outcome_draw: 'Draw',
        open_until: match.match_time,
        status: 'open',
        fee_percent: 0,
        odds_a: 2.1,
        odds_b: 2.1,
        odds_draw: 2.1,
        lp_amount_a: 0, lp_amount_b: 0, lp_amount_draw: 0,
        total_pool: 0, total_bettors: 0,
      });
      
      const marketRes = await base44.functions.invoke('createMarketOnChain', {
        bet_id: bet.id,
        match_id: match.id,
      });
      
      if (marketRes.data.solana_instruction) {
        setPendingMarketInit({
          instruction: marketRes.data.solana_instruction,
          betId: bet.id,
        });
      }
      
      return bet;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bets'] });
      queryClient.invalidateQueries({ queryKey: ['marketStatus', match.id] });
    },
  });

  const handleMarketInitSuccess = (txResult) => {
    setPendingMarketInit(null);
    queryClient.invalidateQueries({ queryKey: ['bets'] });
    queryClient.invalidateQueries({ queryKey: ['marketStatus', match.id] });
    alert('Market initialized on-chain!');
  };

  const handleMarketInitError = (err) => {
    setPendingMarketInit(null);
    alert('Market initialization failed: ' + err.message);
  };

  const updateStatusMutation = useMutation({
    mutationFn: (status) => base44.entities.Match.update(match.id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="flex items-center justify-between p-4 bg-card border border-border/50 rounded-xl"
    >
      <div className="flex items-center gap-3">
        <span className="text-lg">{match.team_a_flag || '🏳️'}</span>
        <div>
          <p className="font-heading font-bold text-sm">{match.team_a} vs {match.team_b}</p>
          <p className="text-[10px] text-muted-foreground">
            {match.match_time ? format(new Date(match.match_time), 'MMM d, HH:mm') : 'TBD'} · {match.venue || 'TBD'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge className="text-[10px] bg-secondary text-secondary-foreground">{match.status}</Badge>
        <Select value={match.status} onValueChange={(v) => updateStatusMutation.mutate(v)}>
          <SelectTrigger className="w-28 h-8 text-xs bg-secondary/50 border-border/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="live">Live</SelectItem>
            <SelectItem value="finished">Finished</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        {!existingBet && !pendingMarketInit && (
          <Button
            size="sm"
            onClick={() => createBetMutation.mutate()}
            disabled={createBetMutation.isPending}
            className="h-8 text-xs bg-primary text-primary-foreground font-heading rounded-lg"
          >
            {createBetMutation.isPending ? (
              <><div className="w-3 h-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-1" /> Creating...</>
            ) : (
              <><Plus className="w-3 h-3 mr-1" /> Initialize Market</>
            )}
          </Button>
        )}
        {pendingMarketInit && (
          <div className="w-64">
            <SolanaTransactionSigner
              instruction={pendingMarketInit.instruction}
              amount={0}
              onSuccess={handleMarketInitSuccess}
              onError={handleMarketInitError}
            />
          </div>
        )}
        {existingBet && isMarketInitialized && (
          <Badge className="bg-accent/20 text-accent text-[10px] py-1 px-3 rounded-lg">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Market Initialized
          </Badge>
        )}
      </div>
    </motion.div>
  );
}