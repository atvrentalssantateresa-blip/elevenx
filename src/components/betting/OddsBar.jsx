import React from 'react';
import { motion } from 'framer-motion';

export default function OddsBar({ totalA, totalB, labelA, labelB, selected, onSelect }) {
  const total = (totalA || 0) + (totalB || 0);
  const pctA = total > 0 ? ((totalA || 0) / total) * 100 : 50;
  const pctB = total > 0 ? ((totalB || 0) / total) * 100 : 50;

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <button
          onClick={() => onSelect('a')}
          className={`flex-1 p-4 rounded-xl border-2 transition-all duration-300 text-left ${
            selected === 'a'
              ? 'border-primary bg-primary/5 shadow-[0_0_20px_-5px_hsl(45,100%,51%,0.2)]'
              : 'border-border/50 bg-card hover:border-border'
          }`}
        >
          <p className="font-heading font-bold text-sm">{labelA}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            ${(totalA || 0).toLocaleString()} staked
          </p>
          <p className={`text-lg font-heading font-bold mt-1 ${selected === 'a' ? 'text-primary' : 'text-foreground'}`}>
            {pctA.toFixed(0)}%
          </p>
        </button>

        <button
          onClick={() => onSelect('b')}
          className={`flex-1 p-4 rounded-xl border-2 transition-all duration-300 text-left ${
            selected === 'b'
              ? 'border-primary bg-primary/5 shadow-[0_0_20px_-5px_hsl(45,100%,51%,0.2)]'
              : 'border-border/50 bg-card hover:border-border'
          }`}
        >
          <p className="font-heading font-bold text-sm">{labelB}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            ${(totalB || 0).toLocaleString()} staked
          </p>
          <p className={`text-lg font-heading font-bold mt-1 ${selected === 'b' ? 'text-primary' : 'text-foreground'}`}>
            {pctB.toFixed(0)}%
          </p>
        </button>
      </div>

      {/* Visual bar */}
      <div className="h-2 bg-secondary rounded-full overflow-hidden flex">
        <motion.div
          className="h-full bg-primary rounded-l-full"
          initial={{ width: '50%' }}
          animate={{ width: `${pctA}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
        <motion.div
          className="h-full bg-accent rounded-r-full"
          initial={{ width: '50%' }}
          animate={{ width: `${pctB}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>

      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{labelA} · {pctA.toFixed(1)}%</span>
        <span>Total Pool: ${total.toLocaleString()}</span>
        <span>{pctB.toFixed(1)}% · {labelB}</span>
      </div>
    </div>
  );
}