import React from 'react';
import { motion } from 'framer-motion';
import { DollarSign, TrendingUp, Wallet, Trophy, XCircle, CheckCircle2, Clock } from 'lucide-react';

export default function LpStatsHeader({ lpPositions }) {
  if (!lpPositions || lpPositions.length === 0) return null;

  // Aggregate LP stats from all positions
  const totalDeposited = lpPositions.reduce((s, p) => s + (p.liquidity_deposited || p.amount_offered || p.amount || 0), 0);
  const totalMatched = lpPositions.reduce((s, p) => s + (p.liquidity_matched || p.amount_matched || 0), 0);
  // Only count unmatched for positions that are still open/active (not withdrawn, settled, claimed, won, lost)
  const activeStatuses = ['open', 'partially_matched', 'pending', 'active'];
  const totalUnmatched = lpPositions
    .filter(p => {
      const s = p.userBet?.status || p.status;
      return activeStatuses.includes(s);
    })
    .reduce((s, p) => s + (p.liquidity_unmatched || p.amount_unmatched || 0), 0);
  const totalFeesEarned = totalMatched * 0.02; // 2% fee on matched portion

  const wonPositions = lpPositions.filter(p => (p.userBet?.status || p.status) === 'won');
  const lostPositions = lpPositions.filter(p => (p.userBet?.status || p.status) === 'lost');
  const claimedPositions = lpPositions.filter(p => (p.userBet?.status || p.status) === 'claimed');
  const activePositions = lpPositions.filter(p => {
    const s = p.userBet?.status || p.status;
    return !['won', 'lost', 'claimed', 'withdrawn', 'refunded'].includes(s);
  });

  const netPL = wonPositions.reduce((s, p) => s + (p.liquidity_matched || p.amount_matched || 0) * 0.02, 0)
              - lostPositions.reduce((s, p) => s + (p.liquidity_matched || p.amount_matched || 0), 0);

  const stats = [
    {
      label: 'Total Deposited',
      value: `◎${totalDeposited.toFixed(4)}`,
      sub: `${lpPositions.length} position${lpPositions.length !== 1 ? 's' : ''}`,
      icon: DollarSign,
      color: 'from-primary/20 to-primary/5 border-primary/30 text-primary',
      iconColor: 'text-primary',
    },
    {
      label: 'Fees Earned',
      value: `◎${totalFeesEarned.toFixed(4)}`,
      sub: `from ◎${totalMatched.toFixed(4)} matched`,
      icon: TrendingUp,
      color: 'from-accent/20 to-accent/5 border-accent/30 text-accent',
      iconColor: 'text-accent',
    },
    {
      label: 'Withdrawable',
      value: `◎${totalUnmatched.toFixed(4)}`,
      sub: 'unmatched liquidity',
      icon: Wallet,
      color: 'from-yellow-500/20 to-yellow-500/5 border-yellow-500/30 text-yellow-400',
      iconColor: 'text-yellow-400',
    },
    {
      label: 'Active Positions',
      value: activePositions.length,
      sub: `${wonPositions.length} won · ${lostPositions.length} lost · ${claimedPositions.length} claimed`,
      icon: Clock,
      color: 'from-secondary/40 to-secondary/10 border-border/30 text-foreground',
      iconColor: 'text-muted-foreground',
    },
  ];

  return (
    <div className="space-y-3">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`bg-gradient-to-br ${stat.color} border rounded-xl p-3 sm:p-4`}
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <stat.icon className={`w-3 h-3 ${stat.iconColor}`} />
              <span className="text-[9px] sm:text-[10px] text-white/40 uppercase tracking-wider font-bold">{stat.label}</span>
            </div>
            <p className="font-heading font-black text-sm sm:text-base">{stat.value}</p>
            <p className="text-[9px] sm:text-[10px] text-white/40 mt-0.5">{stat.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Net P/L Bar */}
      <div className={`flex items-center justify-between rounded-xl px-4 py-3 border ${
        netPL >= 0
          ? 'bg-accent/10 border-accent/30'
          : 'bg-destructive/10 border-destructive/30'
      }`}>
        <div className="flex items-center gap-2">
          {netPL >= 0
            ? <CheckCircle2 className="w-4 h-4 text-accent" />
            : <XCircle className="w-4 h-4 text-destructive" />
          }
          <span className="text-xs font-heading font-bold text-white/60 uppercase tracking-wider">LP Net P/L</span>
        </div>
        <span className={`font-heading font-black text-base ${netPL >= 0 ? 'text-accent' : 'text-destructive'}`}>
          {netPL >= 0 ? '+' : ''}◎{netPL.toFixed(4)}
        </span>
      </div>
    </div>
  );
}