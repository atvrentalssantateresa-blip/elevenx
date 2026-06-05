import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, CheckCircle, AlertCircle, Clock, XCircle, Zap, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import AdminFuturesPanel from './AdminFuturesPanel';

export default function AdminBetRow({ bet, match }) {
  const queryClient = useQueryClient();
  const [isSettling, setIsSettling] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);
  const [marketStatus, setMarketStatus] = useState(null);
  const [marketError, setMarketError] = useState(null);
  const [pendingTx, setPendingTx] = useState(null);

  // Fetch market status from Solana
  const { data: statusData, isLoading: isLoadingStatus } = useQuery({
    queryKey: ['marketStatus', bet.id],
    queryFn: async () => {
      if (!bet.solana_market_pda) return null;
      const res = await base44.functions.invoke('checkMarketStatus', { marketPda: bet.solana_market_pda });
      if (res.data.error) throw new Error(res.data.error);
      return res.data;
    },
    enabled: !!bet.solana_market_pda,
    refetchInterval: 5000,
  });

  React.useEffect(() => {
    if (statusData) {
      setMarketStatus(statusData);
      setMarketError(null);
    }
  }, [statusData]);

  const handleSettle = async (winning_outcome) => {
    if (!walletAddress) {
      alert('Please connect your admin wallet first');
      return;
    }

    setIsSettling(true);
    setMarketError(null);

    try {
      console.log('[AdminBetRow] Wallet address being sent:', walletAddress);
      console.log('[AdminBetRow] Expected admin wallet:', walletAddress);
      console.log('[AdminBetRow] Wallet addresses match:', true);

      const res = await base44.functions.invoke('settleMarketOnChain', {
        bet_id: bet.id,
        match_id: bet.match_id,
        winning_outcome,
        admin_wallet: walletAddress,
      });

      if (res.data.error) {
        throw new Error(res.data.error);
      }

      if (!res.data.solana_instruction) {
        throw new Error('Market not initialized on-chain');
      }

      // Pass to SolanaTransactionSigner
      setPendingTx({
        instruction: res.data.solana_instruction,
        amount: 0,
        type: 'settle_market',
        commit_data: res.data.commit_data,
      });
    } catch (error) {
      console.error('[AdminBetRow] Settlement error:', error);
      setMarketError(error.message);
    } finally {
      setIsSettling(false);
    }
  };

  const handleVoid = async () => {
    if (!walletAddress) {
      alert('Please connect your admin wallet first');
      return;
    }

    setIsVoiding(true);
    setMarketError(null);

    try {
      const res = await base44.functions.invoke('voidMarket', {
        bet_id: bet.id,
        match_id: bet.match_id,
        admin_wallet: walletAddress,
      });

      if (res.data.error) {
        throw new Error(res.data.error);
      }

      if (!res.data.solana_instruction) {
        throw new Error('Market not initialized on-chain');
      }

      setPendingTx({
        instruction: res.data.solana_instruction,
        amount: 0,
        type: 'void_market',
        commit_data: res.data.commit_data,
      });
    } catch (error) {
      console.error('[AdminBetRow] Void error:', error);
      setMarketError(error.message);
    } finally {
      setIsVoiding(false);
    }
  };

  const handleSettlementSuccess = async (txResult) => {
    const signature = txResult.signature;

    // Commit settlement to database
    const commitRes = await base44.functions.invoke('commitSettlement', {
      signature,
      commit_data: pendingTx.commit_data,
    });

    if (commitRes.data.error) {
      console.error('[AdminBetRow] commitSettlement error:', commitRes.data.error);
      setMarketError(commitRes.data.error);
      return;
    }

    console.log('[AdminBetRow] Commit successful:', commitRes.data);

    // CRITICAL: Invalidate ONLY market status to force UI refresh
    queryClient.invalidateQueries({ queryKey: ['marketStatus', bet.id] });

    setPendingTx(null);
    alert(commitRes.data.message);
  };

  const handleVoidSuccess = async (txResult) => {
    const signature = txResult.signature;

    const commitRes = await base44.functions.invoke('commitVoid', {
      signature,
      commit_data: pendingTx.commit_data,
    });

    if (commitRes.data.error) {
      console.error('[AdminBetRow] commitVoid error:', commitRes.data.error);
      setMarketError(commitRes.data.error);
      return;
    }

    // Invalidate queries
    queryClient.invalidateQueries({ queryKey: ['marketStatus', bet.id] });

    setPendingTx(null);
    alert(commitRes.data.message);
  };

  // Get wallet from localStorage
  const [walletAddress, setWalletAddress] = useState(null);

  React.useEffect(() => {
    const stored = localStorage.getItem('elevenx_wallet_session');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        setWalletAddress(data.address);
      } catch (e) {
        console.error('[AdminBetRow] Failed to parse wallet from localStorage:', e);
      }
    }
  }, []);

  if (!match) return null;

  const getStatusBadge = () => {
    if (isLoadingStatus) {
      return (
        <Badge className="bg-muted/10 text-muted-foreground border-muted/30">
          <Clock className="w-3 h-3 mr-1" />
          Loading...
        </Badge>
      );
    }

    if (marketError) {
      return (
        <Badge className="bg-destructive/10 text-destructive border-destructive/30">
          <AlertCircle className="w-3 h-3 mr-1" />
          Error
        </Badge>
      );
    }

    if (!marketStatus) {
      return (
        <Badge className="bg-secondary/10 text-secondary-foreground border-secondary/30">
          Not Deployed
        </Badge>
      );
    }

    const { status, settled, voided, paused, settlement_finalized } = marketStatus;

    if (settlement_finalized) {
      return (
        <Badge className="bg-accent/10 text-accent border-accent/30">
          <CheckCircle className="w-3 h-3 mr-1" />
          Finalized
        </Badge>
      );
    }

    if (settled) {
      return (
        <Badge className="bg-accent/10 text-accent border-accent/30">
          <CheckCircle className="w-3 h-3 mr-1" />
          Settled
        </Badge>
      );
    }

    if (voided) {
      return (
        <Badge className="bg-muted/10 text-muted-foreground border-muted/30">
          <XCircle className="w-3 h-3 mr-1" />
          Voided
        </Badge>
      );
    }

    if (paused) {
      return (
        <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
          <AlertCircle className="w-3 h-3 mr-1" />
          Paused
        </Badge>
      );
    }

    return (
      <Badge className="bg-primary/10 text-primary border-primary/30">
        <TrendingUp className="w-3 h-3 mr-1" />
        {status || 'Active'}
      </Badge>
    );
  };

  return (
    <div className="space-y-3">
      {/* Market Info */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading font-bold text-sm text-white">
            {match.team_a} vs {match.team_b}
          </h3>
          <p className="text-xs text-muted-foreground">{match.group_stage}</p>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge()}
          <a
            href={`https://solscan.io/account/${bet.solana_market_pda}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-primary underline flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            Solscan
          </a>
        </div>
      </div>

      {/* Market Status Details */}
      {marketStatus && !marketError && (
        <div className="bg-secondary/20 border border-border/50 rounded-lg p-3 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status:</span>
            <span className="text-white font-bold">{marketStatus.status}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Settled:</span>
            <span className={marketStatus.settled ? 'text-accent font-bold' : 'text-white'}>
              {marketStatus.settled ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Voided:</span>
            <span className={marketStatus.voided ? 'text-destructive font-bold' : 'text-white'}>
              {marketStatus.voided ? 'Yes' : 'No'}
            </span>
          </div>
          {marketStatus.winning_outcome !== undefined && marketStatus.winning_outcome !== 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Winner:</span>
              <span className="text-accent font-bold">
                {marketStatus.winning_outcome === 0 ? 'Team A' : marketStatus.winning_outcome === 1 ? 'Team B' : 'Draw'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {marketError && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-xs text-destructive">
          <AlertCircle className="w-4 h-4 mb-1" />
          {marketError}
        </div>
      )}

      {/* Admin Actions */}
      <div className="flex gap-2">
        {!marketStatus?.settled && !marketStatus?.voided && (
          <>
            <Button
              onClick={() => handleSettle('a')}
              disabled={isSettling || !walletAddress}
              size="sm"
              className="flex-1 h-8 text-xs bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-lg"
            >
              {isSettling ? 'Settling...' : 'Settle A'}
            </Button>
            <Button
              onClick={() => handleSettle('b')}
              disabled={isSettling || !walletAddress}
              size="sm"
              className="flex-1 h-8 text-xs bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-lg"
            >
              {isSettling ? 'Settling...' : 'Settle B'}
            </Button>
            <Button
              onClick={() => handleSettle('draw')}
              disabled={isSettling || !walletAddress}
              size="sm"
              className="flex-1 h-8 text-xs bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-lg"
            >
              {isSettling ? 'Settling...' : 'Settle Draw'}
            </Button>
            <Button
              onClick={handleVoid}
              disabled={isVoiding || !walletAddress}
              size="sm"
              variant="outline"
              className="h-8 text-xs border-destructive/30 text-destructive hover:bg-destructive/10 rounded-lg"
            >
              {isVoiding ? 'Voiding...' : 'Void'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}