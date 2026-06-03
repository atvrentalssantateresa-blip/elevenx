import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Trophy, TrendingUp, Loader } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function FuturesBetSlip({ market, outcome, onClose, onConfirm }) {
  const [amount, setAmount] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);

  const numericAmount = parseFloat(amount) || 0;
  const potentialPayout = numericAmount * (outcome.odds || 0);

  const handleConfirm = async () => {
    if (!amount || numericAmount <= 0) return;
    
    setIsConfirming(true);
    try {
      await onConfirm({
        market,
        outcome,
        amount: numericAmount,
        potentialPayout,
      });
    } finally {
      setIsConfirming(false);
    }
  };

  const positionBadge = outcome.position === '1st' ? '🥇' : outcome.position === '2nd' ? '🥈' : '🥉';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border/50 rounded-3xl p-6 max-w-md w-full shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/10 border-2 border-primary/30 flex items-center justify-center text-2xl">
              {market.country_flag || '🏳️'}
            </div>
            <div>
              <h3 className="font-heading font-bold text-base">{market.country}</h3>
              <div className="flex items-center gap-2">
                <Badge className="text-[9px] bg-primary/15 text-primary border border-primary/25">
                  {positionBadge} {outcome.position} Place
                </Badge>
                <span className="text-[9px] text-muted-foreground">Futures</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-secondary/50 hover:bg-secondary flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Bet Details */}
        <div className="bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/20 rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Multiplier</span>
            </div>
            <span className="font-heading font-black text-2xl text-primary">
              {outcome.odds?.toFixed(2)}x
            </span>
          </div>
          <div className="pt-3 border-t border-primary/10">
            <p className="text-[10px] text-muted-foreground">
              If {market.country} finishes {outcome.position}, you win {outcome.odds?.toFixed(2)}x your stake!
            </p>
          </div>
        </div>

        {/* Amount Input */}
        <div className="mb-6">
          <Label className="text-xs mb-2 block font-bold">Stake Amount (SOL)</Label>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="bg-secondary/50 text-lg font-bold h-12 rounded-xl"
            autoFocus
          />
        </div>

        {/* Payout Summary */}
        {numericAmount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-accent/5 border border-accent/20 rounded-2xl p-4 mb-6"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Potential Payout</span>
              <span className="font-heading font-black text-xl text-accent">
                ◎{potentialPayout.toFixed(4)} SOL
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Stake</span>
              <span className="font-bold text-sm">◎{numericAmount.toFixed(4)} SOL</span>
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-accent/10">
              <span className="text-xs text-muted-foreground">Profit</span>
              <span className="font-bold text-sm text-accent">
                +◎{(potentialPayout - numericAmount).toFixed(4)} SOL
              </span>
            </div>
          </motion.div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 h-11 rounded-xl font-bold"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!amount || numericAmount <= 0 || isConfirming}
            className="flex-1 h-11 rounded-xl font-bold bg-primary hover:bg-primary/90"
          >
            {isConfirming ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Confirming...
              </>
            ) : (
              <>
                <Trophy className="w-4 h-4 mr-2" />
                Place Bet
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}