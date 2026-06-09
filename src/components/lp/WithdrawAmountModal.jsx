import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, X } from 'lucide-react';
import { motion } from 'framer-motion';

export default function WithdrawAmountModal({ open, onClose, maxAmount, title, onConfirm, isLoading }) {
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [error, setError] = useState('');

  const handleConfirm = () => {
    setError('');
    const amount = parseFloat(withdrawAmount);

    if (!withdrawAmount || amount <= 0) {
      setError('Enter a valid amount');
      return;
    }

    if (amount > maxAmount) {
      setError(`Cannot exceed ◎${maxAmount.toFixed(4)}`);
      return;
    }

    // Call the parent's onConfirm with the selected amount
    onConfirm(amount);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card border border-border/50 rounded-2xl p-6 max-w-sm w-full">
        
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-bold text-lg">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Max amount info */}
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-3">
            <p className="text-xs text-muted-foreground mb-1">Available to Withdraw</p>
            <p className="font-heading font-bold text-lg text-primary">◎{maxAmount.toFixed(4)}</p>
          </div>

          {/* Amount input */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground font-bold uppercase tracking-wider">
              Withdraw Amount
            </label>
            <Input
              type="number"
              placeholder="0.0000"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              className="text-lg font-heading font-bold"
              step="0.0001"
              min="0"
              max={maxAmount}
            />
          </div>

          {/* Quick fill buttons */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWithdrawAmount(String(maxAmount * 0.25))}
              className="text-xs">
              25%
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWithdrawAmount(String(maxAmount * 0.5))}
              className="text-xs">
              50%
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWithdrawAmount(String(maxAmount))}
              className="text-xs">
              Max
            </Button>
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isLoading || !withdrawAmount}
              className="flex-1 font-heading font-bold"
              style={{ background: 'linear-gradient(135deg, #a69cf2, #8b84e8)' }}>
              {isLoading ? 'Processing...' : 'Confirm Withdrawal'}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}