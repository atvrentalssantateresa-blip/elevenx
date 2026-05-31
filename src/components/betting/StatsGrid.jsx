import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Users, DollarSign, Trophy } from 'lucide-react';

export default function StatsGrid({ stats }) {
  const items = [
    { icon: DollarSign, label: 'Total Volume', value: `$${(stats.totalVolume || 0).toLocaleString()}`, color: 'text-primary' },
    { icon: Users, label: 'Active Bettors', value: stats.activeBettors || 0, color: 'text-accent' },
    { icon: Trophy, label: 'Open Bets', value: stats.openBets || 0, color: 'text-foreground' },
    { icon: TrendingUp, label: 'Matches', value: stats.totalMatches || 0, color: 'text-muted-foreground' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((item, i) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08, duration: 0.4 }}
          className="bg-card border border-border/50 rounded-2xl p-4"
        >
          <item.icon className={`w-5 h-5 ${item.color} mb-2`} />
          <p className={`font-heading font-bold text-xl ${item.color}`}>{item.value}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{item.label}</p>
        </motion.div>
      ))}
    </div>
  );
}