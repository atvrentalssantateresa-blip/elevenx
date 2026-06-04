import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2, X, TrendingUp, Users, Clock, Zap, ArrowRight, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/AuthContext';
import { useWallet } from '@/lib/WalletContext';
import { motion } from 'framer-motion';

export default function OfferBook({ betId, bet, onSelectOffer }) {
  const { user } = useAuth();
  const { walletAddress } = useWallet();
  const queryClient = useQueryClient();

  const { data: offers = [], isLoading, refetch } = useQuery({
    queryKey: ['offers', betId],
    queryFn: () => base44.entities.BetOffer.filter({ bet_id: betId }),
    enabled: !!betId,
    refetchInterval: 15000,
    refetchOnWindowFocus: false,
    staleTime: 10000
  });

  const { data: userBets = [] } = useQuery({
    queryKey: ['userBets', betId, walletAddress],
    queryFn: () => base44.entities.UserBet.filter({ bet_id: betId, role: 'matcher' }),
    enabled: !!betId && !!walletAddress,
    refetchInterval: 15000,
    refetchOnWindowFocus: false,
    staleTime: 10000
  });

  const withdrawMutation = useMutation({
    mutationFn: (offerId) => base44.functions.invoke('withdrawOffer', { offer_id: offerId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers', betId] });
      queryClient.invalidateQueries({ queryKey: ['betsForMatch'] });
    },
  });

  const openOffers = offers.filter(o => o.status === 'open' || o.status === 'partially_matched');

  const getOutcomeColor = (outcome) => {
    if (outcome === 'a') return 'text-primary';
    if (outcome === 'b') return 'text-accent';
    return 'text-yellow-400';
  };

  const getOutcomeBg = (outcome) => {
    if (outcome === 'a') return 'bg-primary/5';
    if (outcome === 'b') return 'bg-accent/5';
    return 'bg-yellow-500/5';
  };

  const getOutcomeBorder = (outcome) => {
    if (outcome === 'a') return 'border-primary/30 hover:border-primary/50';
    if (outcome === 'b') return 'border-accent/30 hover:border-accent/50';
    return 'border-yellow-500/30 hover:border-yellow-500/50';
  };

  const getOutcomeButtonColor = (outcome) => {
    if (outcome === 'a') return 'bg-primary hover:bg-primary/90 text-primary-foreground';
    if (outcome === 'b') return 'bg-accent hover:bg-accent/90 text-accent-foreground';
    return 'bg-yellow-500 hover:bg-yellow-500/90 text-white';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="bg-card border border-border/50 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h3 className="font-heading font-bold text-sm">Liquidity Pool</h3>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            {openOffers.length} offers
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => refetch()}
          >
            <Loader2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {openOffers.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-8"
        >
          <Zap className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No open offers yet</p>
          <p className="text-[10px] text-muted-foreground mt-1">Be the first to add liquidity!</p>
        </motion.div>
      ) : (
        <div className="grid gap-2">
          {openOffers.map((offer, index) => {
            const isOwn = offer.created_by_id === user?.id;
            const maxMatcherStake = offer.amount_unmatched * ((offer.odds_at_creation || 2.0) - 1);
            const outcomeLabel = offer.outcome === 'a' ? bet?.outcome_a : offer.outcome === 'b' ? bet?.outcome_b : 'Draw';
            const oppositeLabel = offer.outcome === 'a' ? bet?.outcome_b : offer.outcome === 'b' ? bet?.outcome_a : `${bet?.outcome_a} or ${bet?.outcome_b}`;
            const matchRate = offer.amount_offered > 0 ? Math.round((offer.amount_matched / offer.amount_offered) * 100) : 0;
            
            const userBetsOnThisOffer = userBets.filter(bet => bet.offer_id === offer.id);
            const totalUserStake = userBetsOnThisOffer.reduce((sum, bet) => sum + (bet.amount || 0), 0);
            const totalUserPotentialPayout = userBetsOnThisOffer.reduce((sum, bet) => sum + (bet.potential_payout || 0), 0);

            return (
              <motion.div
                key={offer.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`rounded-xl border p-4 transition-all duration-200 hover:shadow-lg ${getOutcomeBg(offer.outcome)} ${getOutcomeBorder(offer.outcome)}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-3">
                    {/* Header Row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-heading font-bold text-base ${getOutcomeColor(offer.outcome)}`}>
                        {outcomeLabel}
                      </span>
                      <Badge className={`${getOutcomeButtonColor(offer.outcome)} text-[10px] font-bold px-2 py-0.5`}>
                        @{offer.odds_at_creation?.toFixed(2)}x
                      </Badge>
                      {offer.status === 'partially_matched' && (
                        <Badge className="text-[9px] bg-yellow-500/20 text-yellow-400 py-0 border border-yellow-500/30">
                          Partially Matched
                        </Badge>
                      )}
                      {offer.status === 'open' && (
                        <Badge className="text-[9px] bg-primary/20 text-primary py-0 border border-primary/30">
                          Open
                        </Badge>
                      )}
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-card/50 rounded-lg p-2 border border-border/30">
                        <div className="flex items-center gap-1 mb-0.5">
                          <Target className="w-2.5 h-2.5 text-muted-foreground" />
                          <span className="text-[9px] text-muted-foreground uppercase">Offered</span>
                        </div>
                        <p className="font-heading font-bold text-sm">◎{(offer.amount_offered || 0).toFixed(4)}</p>
                      </div>
                      
                      <div className="bg-card/50 rounded-lg p-2 border border-border/30">
                        <div className="flex items-center gap-1 mb-0.5">
                          <Users className="w-2.5 h-2.5 text-accent" />
                          <span className="text-[9px] text-muted-foreground uppercase">Matched</span>
                        </div>
                        <p className="font-heading font-bold text-accent text-sm">◎{(offer.amount_matched || 0).toFixed(4)}</p>
                      </div>
                      
                      <div className="bg-card/50 rounded-lg p-2 border border-border/30">
                        <div className="flex items-center gap-1 mb-0.5">
                          <Clock className="w-2.5 h-2.5 text-yellow-400" />
                          <span className="text-[9px] text-muted-foreground uppercase">Available</span>
                        </div>
                        <p className="font-heading font-bold text-yellow-400 text-sm">◎{(offer.amount_unmatched || 0).toFixed(4)}</p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div>
                      <div className="flex items-center justify-between text-[9px] text-muted-foreground mb-1">
                        <span>Match Rate</span>
                        <span className="font-bold">{matchRate}%</span>
                      </div>
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            matchRate === 100 ? 'bg-accent' :
                            matchRate > 50 ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' :
                            'bg-gradient-to-r from-primary/50 to-primary'
                          }`}
                          style={{ width: `${matchRate}%` }}
                        />
                      </div>
                    </div>

                    {/* User's Position (if any) */}
                    {!isOwn && totalUserStake > 0 && (
                      <div className="bg-primary/5 rounded-lg p-2.5 border border-primary/20 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Users className="w-3 h-3 text-primary" />
                            <span className="text-[10px] text-primary font-medium">Your Position</span>
                          </div>
                          <span className="font-bold text-primary text-sm">◎{totalUserStake.toFixed(4)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">Potential Return</span>
                          <span className="font-bold text-accent text-sm">◎{totalUserPotentialPayout.toFixed(4)}</span>
                        </div>
                      </div>
                    )}

                    {/* Betting Info (if no position) */}
                    {!isOwn && totalUserStake === 0 && (
                      <div className="bg-accent/5 rounded-lg p-2.5 border border-accent/20">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <ArrowRight className="w-3 h-3 text-accent" />
                            <span className="text-[10px] text-accent font-medium">You can bet up to</span>
                          </div>
                          <span className="font-bold text-accent text-sm">◎{maxMatcherStake.toFixed(4)}</span>
                        </div>
                        <p className="text-[9px] text-muted-foreground mt-1">
                          on <strong>{oppositeLabel}</strong> against this offer
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                  {isOwn ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-3 text-xs border-destructive/30 text-destructive hover:bg-destructive/10 rounded-lg font-heading font-bold"
                      onClick={() => withdrawMutation.mutate(offer.id)}
                      disabled={withdrawMutation.isPending}
                    >
                      {withdrawMutation.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <>
                          <X className="w-3 h-3" />
                          <span className="ml-1">Withdraw</span>
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className={`h-8 px-4 text-xs font-bold rounded-lg ${getOutcomeButtonColor(offer.outcome)} disabled:opacity-50 disabled:cursor-not-allowed`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('[OfferBook] Bet Against clicked:', {
                          offer_id: offer.id,
                          outcome: offer.outcome,
                          amount_unmatched: offer.amount_unmatched,
                          status: offer.status
                        });
                        if (onSelectOffer) {
                          onSelectOffer(offer);
                        } else {
                          console.error('[OfferBook] onSelectOffer is not defined!');
                        }
                      }}
                      disabled={!onSelectOffer || (offer.amount_unmatched || 0) <= 0}
                    >
                      Bet Against
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}