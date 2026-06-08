import React from 'react';
import { motion } from 'framer-motion';
import { Vault, Shield, Lock, Clock, TrendingUp, DollarSign, ExternalLink, Crown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function ProtocolVault({ daoBalance, unresolvedStakes, unclaimedWinnings, feeVaultPda }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="relative overflow-hidden rounded-3xl p-5 sm:p-6"
      style={{ background: '#0F111A', border: '1px solid rgba(153, 69, 255, 0.2)' }}>
      
      {/* Glow effects */}
      <div className="absolute top-0 right-0 w-36 h-36 rounded-full blur-3xl opacity-20" style={{ background: '#a69cf2' }} />
      <div className="absolute bottom-0 left-0 w-28 h-28 rounded-full blur-3xl opacity-15" style={{ background: '#14f195' }} />
      
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 px-2.5 py-1.5 rounded-full">
            <Crown className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] font-bold text-primary tracking-widest">PROTOCOL VAULT</span>
          </div>
          <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold">
            ON-CHAIN LIVE
          </Badge>
        </div>

        <h2 className="font-heading font-black text-lg sm:text-xl text-white leading-tight mb-4">
          Treasury & Fee Ledger
        </h2>

        {/* Stats Grid */}
        <div className="space-y-2.5">
          {/* Treasury Balance */}
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/5">
            <div className="flex items-center gap-1.5 mb-1">
              <Shield className="w-3 h-3 text-emerald-400" />
              <p className="text-[9px] text-white/40 uppercase tracking-widest">Accumulated Fees</p>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-heading font-black text-emerald-400">◎{daoBalance.toFixed(4)}</span>
              <span className="text-xs text-white/30">SOL</span>
            </div>
          </div>

          {/* Unresolved Stakes */}
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/5">
            <div className="flex items-center gap-1.5 mb-1">
              <Lock className="w-3 h-3 text-yellow-400" />
              <p className="text-[9px] text-white/40 uppercase tracking-widest">Unresolved Stakes</p>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-base font-heading font-bold text-yellow-400">◎{unresolvedStakes.toFixed(4)}</span>
              <span className="text-[10px] text-white/30">in pools</span>
            </div>
          </div>

          {/* Unclaimed Winnings */}
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/5">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="w-3 h-3 text-purple-400" />
              <p className="text-[9px] text-white/40 uppercase tracking-widest">Unclaimed Winnings</p>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-base font-heading font-bold text-purple-400">◎{unclaimedWinnings.toFixed(4)}</span>
              <span className="text-[10px] text-white/30">pending</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
          <div className="text-[9px] text-white/40">
            <p className="mb-0.5">Vault: {feeVaultPda ? `${feeVaultPda.slice(0, 6)}...${feeVaultPda.slice(-4)}` : 'N/A'}</p>
            <p className="flex items-center gap-1 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Direct feed
            </p>
          </div>
          {feeVaultPda && (
            <a
              href={`https://solscan.io/account/${feeVaultPda}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[9px] text-primary hover:text-primary/80 transition-colors">
              <ExternalLink className="w-3 h-3" />
              Solscan
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}