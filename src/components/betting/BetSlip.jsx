import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, TrendingUp, AlertCircle } from 'lucide-react';

export default function BetSlip({ bet, selectedOutcome, onPlaceBet, isPlacing }) {
  const [amount, setAmount] = useState('');
  const quickAmounts = [10, 25, 50, 100, 250];

  const totalOnSelected = selectedOutcome === 'a' ? (bet.total_a || 0) : (bet.total_b || 0);
  const totalOnOther = selectedOutcome === 'a' ? (bet.total_b || 0) : (bet.total_a || 0);
  const amountNum = parseFloat(amount) || 0;

  // Calculate potential payout
  const newWinnersPool = totalOnSelected + amountNum;
  const losersPool = totalOnOther;
  const grossPayout = amountNum > 0 && newWinnersPool > 0
    ? amountNum + (amountNum / newWinnersPool) * losersPool
    : 0;
  const fee = grossPayout * (bet.fee_percent || 200) / 10000;
  const netPayout = grossPayout - fee;
  const multiplier = amountNum > 0 ? netPayout / amountNum : 0;

  const outcomeName = selectedOutcome === 'a' ? bet.outcome_a : bet.outcome_b;

  const handleSubmit = () => {
    if (amountNum <= 0) return;
    onPlaceBet(amountNum);
    setAmount('');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-primary/20 rounded-2xl p-5 shadow-[0_0_40px_-15px_hsl(45,100%,51%,0.1)]"
    >
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-4 h-4 text-primary" />
        <h3 className="font-heading font-bold text-sm">Bet Slip</h3>
      </div>

      <div className="bg-secondary/50 rounded-xl p-3 mb-4">
        <p className="text-xs text-muted-foreground mb-1">Your pick</p>
        <p className="font-heading font-bold text-primary">{outcomeName}</p>
        <div className="flex items-center gap-2 mt-1">
          <TrendingUp className="w-3 h-3 text-accent" />
          <span className="text-xs text-muted-foreground">
            Current pool: ${totalOnSelected.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Amount input */}
      <div className="mb-3">
        <label className="text-xs text-muted-foreground mb-1.5 block">Stake amount ($)</label>
        <Input
          type="number"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="bg-secondary/50 border-border/50 text-lg font-heading font-bold h-12"
        />
      </div>

      {/* Quick amounts */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {quickAmounts.map(qa => (
          <button
            key={qa}
            onClick={() => setAmount(String(qa))}
            className="px-3 py-1.5 text-xs font-medium bg-secondary hover:bg-secondary/80 rounded-lg transition-colors text-foreground"
          >
            ${qa}
          </button>
        ))}
      </div>

      {/* Payout estimate */}
      <AnimatePresence>
        {amountNum > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-accent/5 border border-accent/20 rounded-xl p-3 mb-4 space-y-2"
          >
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Potential payout</span>
              <span className="font-bold text-accent">${netPayout.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Multiplier</span>
              <span className="font-bold text-foreground">{multiplier.toFixed(2)}x</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Fee ({(bet.fee_percent || 200) / 100}%)</span>
              <span className="text-muted-foreground">${fee.toFixed(2)}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        onClick={handleSubmit}
        disabled={amountNum <= 0 || isPlacing}
        className="w-full h-12 font-heading font-bold text-base bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl"
      >
        {isPlacing ? (
          <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
        ) : (
          `Place $${amountNum.toFixed(2)} Bet`
        )}
      </Button>

      <p className="text-[10px] text-muted-foreground text-center mt-2 flex items-center justify-center gap-1">
        <AlertCircle className="w-3 h-3" />
        Bets are final and non-refundable
      </p>
    </motion.div>
  );
}