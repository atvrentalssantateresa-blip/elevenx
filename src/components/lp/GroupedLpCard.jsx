import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Trophy, Clock, CheckCircle2, DollarSign, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getTeamFlag } from '@/utils/flags';
import LpPositionCard from './LpPositionCard';

export default function GroupedLpCard({ position, match, futuresMarket, walletAddress, onWithdrawRequest }) {
  const isFutures = position._isFutures || position.match_id === position.bet_id;
  
  // Calculate totals from grouped transactions
  const totalDeposited = position.total_liquidity_deposited || position.liquidity_deposited || position.amount_offered || 0;
  const totalMatched = position.total_liquidity_matched || position.amount_matched || 0;
  const totalUnmatched = position.total_liquidity_unmatched || position.amount_unmatched || 0;
  const feesEarned = totalMatched * 0.02; // 2% fee
  
  const statusColors = {
    open: 'bg-accent/10 text-accent border-accent/20',
    partially_matched: 'bg-primary/10 text-primary border-primary/20',
    fully_matched: 'bg-primary/20 text-primary border-primary/30',
    withdrawn: 'bg-muted text-muted-foreground border-border',
    settled: 'bg-muted text-muted-foreground border-border',
    won: 'bg-accent/10 text-accent border-accent/20',
    lost: 'bg-destructive/10 text-destructive border-destructive/20',
  };

  const statusLabels = {
    open: 'Open',
    partially_matched: 'Partially Matched',
    fully_matched: 'Fully Matched',
    withdrawn: 'Withdrawn',
    settled: 'Settled',
    won: 'Won',
    lost: 'Lost',
  };

  const status = position.status || 'open';
  const statusStyle = statusColors[status] || statusColors.open;
  const statusLabel = statusLabels[status] || status;

  // Get match/market title
  const getTitle = () => {
    if (isFutures) {
      if (futuresMarket) {
        return `${futuresMarket.country_flag} ${futuresMarket.country} - ${futuresMarket.subtitle || futuresMarket.title}`;
      }
      return 'Futures Market';
    }
    if (match) {
      return `${getTeamFlag(match.team_a, match.team_a_flag)} ${match.team_a} vs ${match.team_b} ${getTeamFlag(match.team_b, match.team_b_flag)}`;
    }
    return 'Match';
  };

  const getOutcomeIcon = () => {
    if (isFutures) {
      return <Trophy className="w-4 h-4 text-yellow-400" />;
    }
    return <TrendingUp className="w-4 h-4 text-primary" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl p-4 border overflow-hidden ${isFutures ? 'bg-gradient-to-br from-yellow-500/5 to-orange-500/5 border-yellow-500/20' : 'bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20'}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {getOutcomeIcon()}
          <div className="flex-1 min-w-0">
            <h3 className="font-heading font-bold text-xs text-foreground truncate">{getTitle()}</h3>
            <p className="text-[10px] text-muted-foreground truncate">
              {isFutures ? position.outcome_label : `${position.outcome_label} (${match ? `${match.team_a} vs ${match.team_b}` : ''})`}
            </p>
          </div>
        </div>
        <Badge className={`${statusStyle} text-[9px] font-semibold uppercase tracking-wider border flex-shrink-0`}>
          {statusLabel}
        </Badge>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-card/50 rounded-lg p-2">
          <div className="flex items-center gap-1 mb-1">
            <DollarSign className="w-3 h-3 text-muted-foreground" />
            <p className="text-[8px] text-muted-foreground">Deposited</p>
          </div>
          <p className="font-heading font-bold text-sm text-foreground">◎{totalDeposited.toFixed(4)}</p>
        </div>
        <div className="bg-card/50 rounded-lg p-2">
          <div className="flex items-center gap-1 mb-1">
            <CheckCircle2 className="w-3 h-3 text-muted-foreground" />
            <p className="text-[8px] text-muted-foreground">Matched</p>
          </div>
          <p className="font-heading font-bold text-sm text-accent">◎{totalMatched.toFixed(4)}</p>
        </div>
        <div className="bg-card/50 rounded-lg p-2">
          <div className="flex items-center gap-1 mb-1">
            <Clock className="w-3 h-3 text-muted-foreground" />
            <p className="text-[8px] text-muted-foreground">Unmatched</p>
          </div>
          <p className="font-heading font-bold text-sm text-yellow-400">◎{totalUnmatched.toFixed(4)}</p>
        </div>
        <div className="bg-card/50 rounded-lg p-2">
          <div className="flex items-center gap-1 mb-1">
            <TrendingUp className="w-3 h-3 text-muted-foreground" />
            <p className="text-[8px] text-muted-foreground">Fees Earned</p>
          </div>
          <p className="font-heading font-bold text-sm text-accent">◎{feesEarned.toFixed(4)}</p>
        </div>
      </div>

      {/* Transaction count badge if grouped */}
      {position._groupedTransactions && position._groupedTransactions.length > 1 && (
        <div className="mb-3 flex items-center gap-1 text-[9px] text-muted-foreground bg-secondary/50 px-2 py-1 rounded-md">
          <CheckCircle2 className="w-3 h-3" />
          <span>{position._groupedTransactions.length} transactions grouped</span>
        </div>
      )}

      {/* Action Button */}
      {(totalUnmatched > 0 || status === 'won') && (
        <Button
          onClick={() => onWithdrawRequest({
            positionId: position.userBetId || position.id,
            offerId: position.id,
            withdrawAmount: totalUnmatched > 0 ? totalUnmatched : (totalDeposited + feesEarned),
            solanaInstruction: null, // Will be fetched by parent
            isFutures,
          })}
          className="w-full h-9 rounded-xl font-heading font-bold text-xs"
          variant={status === 'won' ? 'default' : 'outline'}
          style={status !== 'won' ? { background: 'linear-gradient(135deg, #a69cf2, #8b84e8)' } : {}}
        >
          {status === 'won' ? 'Claim Winnings' : 'Withdraw Unmatched'}
          <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
        </Button>
      )}
    </motion.div>
  );
}