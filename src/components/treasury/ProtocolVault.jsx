import React from 'react';
import { motion } from 'framer-motion';
import { Shield, TrendingUp, Lock, Clock } from 'lucide-react';

export default function ProtocolVault({ daoBalance, unresolvedStakes, unclaimedWinnings, feeVaultPda }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      className="relative bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 backdrop-blur-sm rounded-2xl p-4 border border-emerald-500/20">
      
      {/* Glow effects */}
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl opacity-15" style={{ background: '#14f195' }} />
      <div className="absolute bottom-0 left-0 w-16 h-16 rounded-full blur-2xl opacity-10" style={{ background: '#10b981' }} />
      
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-emerald-500/20">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
            <Shield className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Protocol Vault</span>
            <span className="text-[8px] text-emerald-400/60 block">Live Treasury Stats</span>
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <TrendingUp className="w-3 h-3 text-emerald-400" />
              </div>
              <span className="text-[10px] text-white/50 font-medium">Accumulated Fees</span>
            </div>
            <span className="text-sm font-bold text-emerald-400">◎{daoBalance.toFixed(4)}</span>
          </div>
          
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                <Lock className="w-3 h-3 text-yellow-400" />
              </div>
              <span className="text-[10px] text-white/50 font-medium">Locked in Pools</span>
            </div>
            <span className="text-sm font-bold text-yellow-400">◎{unresolvedStakes.toFixed(4)}</span>
          </div>
          
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <Clock className="w-3 h-3 text-purple-400" />
              </div>
              <span className="text-[10px] text-white/50 font-medium">Unclaimed</span>
            </div>
            <span className="text-sm font-bold text-purple-400">◎{unclaimedWinnings.toFixed(4)}</span>
          </div>
        </div>

        {/* Footer */}
        {feeVaultPda && (
          <div className="mt-3 pt-3 border-t border-emerald-500/20 flex items-center justify-between">
            <a
              href={`https://solscan.io/account/${feeVaultPda}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] text-emerald-400/60 hover:text-emerald-400 transition-colors truncate max-w-[140px] font-mono">
              {feeVaultPda.slice(0, 6)}...{feeVaultPda.slice(-6)}
            </a>
            <div className="flex items-center gap-1.5 text-[9px] text-emerald-400 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              ON-CHAIN
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}