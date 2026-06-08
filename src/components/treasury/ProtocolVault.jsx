import React from 'react';
import { motion } from 'framer-motion';
import { Shield, TrendingUp, Clock } from 'lucide-react';

export default function ProtocolVault({ daoBalance, unresolvedStakes, unclaimedWinnings, feeVaultPda }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      className="relative bg-white/5 backdrop-blur-sm rounded-2xl p-3 border border-white/10">
      
      {/* Subtle glow */}
      <div className="absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl opacity-10" style={{ background: '#14f195' }} />
      
      <div className="relative z-10 space-y-2">
        {/* Header */}
        <div className="flex items-center gap-1.5 mb-2">
          <Shield className="w-3 h-3 text-emerald-400" />
          <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Protocol Vault</span>
        </div>

        {/* Stats */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[9px] text-white/40">Fees</span>
            <span className="text-xs font-bold text-emerald-400">◎{daoBalance.toFixed(4)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[9px] text-white/40">Locked</span>
            <span className="text-xs font-bold text-yellow-400">◎{unresolvedStakes.toFixed(4)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[9px] text-white/40">Unclaimed</span>
            <span className="text-xs font-bold text-purple-400">◎{unclaimedWinnings.toFixed(4)}</span>
          </div>
        </div>

        {/* Footer */}
        {feeVaultPda && (
          <div className="pt-2 border-t border-white/5 flex items-center justify-between">
            <a
              href={`https://solscan.io/account/${feeVaultPda}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[8px] text-white/30 hover:text-primary transition-colors truncate max-w-[120px]">
              {feeVaultPda.slice(0, 4)}...{feeVaultPda.slice(-4)}
            </a>
            <div className="flex items-center gap-1 text-[8px] text-emerald-400">
              <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}