import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, CheckCircle, AlertCircle, Clock, XCircle, TrendingUp, RefreshCcw } from 'lucide-react';

export default function AdminBetRow({ bet, match, onSettle, onVoid }) {
  const [walletAddress, setWalletAddress] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem('elevenx_wallet_session');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        setWalletAddress(data.address);
      } catch (e) {
        console.error('[AdminBetRow] Failed to parse wallet:', e);
      }
    }
  }, []);

  const { data: marketStatus, isLoading: isLoadingStatus } = useQuery({
    queryKey: ['marketStatus', bet.id],
    queryFn: async () => {
      if (!bet.match_id) return null;
      const res = await base44.functions.invoke('checkMarketStatus', { match_id: bet.match_id });
      if (res.data.error) throw new Error(res.data.error);
      return res.data;
    },
    enabled: !!bet.match_id,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: false,
  });

  if (!match) return null;

  const getStatusBadge = () => {
    if (isLoadingStatus) {
      return <Badge className="bg-muted/10 text-muted-foreground border-muted/30"><Clock className="w-3 h-3 mr-1" />Loading...</Badge>;
    }

    if (!marketStatus) {
      return <Badge className="bg-secondary/10 text-secondary-foreground border-secondary/30">Not Deployed</Badge>;
    }

    const { settled, voided, paused, settlement_finalized } = marketStatus;

    // CRITICAL: When market is settled (even with voided=true from old state), show as settled
    // This handles the case where on-chain state has both flags set due to Draw settlement with no winners
    if (settlement_finalized || settled) {
      return <Badge className="bg-accent/10 text-accent border-accent/30"><CheckCircle className="w-3 h-3 mr-1" />{settlement_finalized ? 'Finalized' : 'Settled'}</Badge>;
    }

    // Only show voided if NOT settled (prevents false voided display after successful settlement)
    if (voided && !settled) {
      return <Badge className="bg-muted/10 text-muted-foreground border-muted/30"><XCircle className="w-3 h-3 mr-1" />Voided</Badge>;
    }

    if (paused) {
      return <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30"><AlertCircle className="w-3 h-3 mr-1" />Paused</Badge>;
    }

    return <Badge className="bg-primary/10 text-primary border-primary/30"><TrendingUp className="w-3 h-3 mr-1" />Active</Badge>;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading font-bold text-sm text-white">{match.team_a} vs {match.team_b}</h3>
          <p className="text-xs text-muted-foreground">{match.group_stage}</p>
          <p className="text-[10px] font-mono text-muted-foreground mt-1">Bet ID: {bet.id}</p>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge()}
          {bet.solana_market_pda && (
            <>
              <a href={`https://solscan.io/account/${bet.solana_market_pda}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary underline flex items-center gap-1">
                <ExternalLink className="w-3 h-3" />Solscan
              </a>
              <Button 
                onClick={async () => {
                  const res = await base44.functions.invoke('debugMarketSettlement', { match_id: bet.match_id });
                  console.log('[AdminBetRow] Debug result:', res.data);
                  alert(JSON.stringify(res.data, null, 2));
                }}
                size="sm"
                className="h-6 text-[9px] bg-gray-700 hover:bg-gray-600 text-white border-gray-600 rounded-lg"
              >
                Debug
              </Button>
            </>
          )}
        </div>
      </div>

      {marketStatus && (
        <div className="bg-secondary/20 border border-border/50 rounded-lg p-3 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status:</span>
            <span className="text-white font-bold">{marketStatus.status}</span>
          </div>
          {marketStatus.voided && !marketStatus.settled && (
            <div className="flex justify-between bg-destructive/20 border border-destructive/50 rounded px-2 py-1 -mx-2 -my-1">
              <span className="text-destructive font-bold">⚠️ VOIDED</span>
              <span className="text-destructive/80">Market auto-voided - bets will be refunded</span>
            </div>
          )}
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

      <div className="flex gap-2">
        {marketStatus?.voided && !marketStatus?.settled ? (
          <Badge className="flex-1 bg-destructive/10 text-destructive border-destructive/30 px-3 py-2 justify-center">
            <AlertCircle className="w-3 h-3 mr-1" />
            Market Voided - Refunds in Progress
          </Badge>
        ) : marketStatus?.settled || marketStatus?.settlement_finalized ? (
          <>
            <Badge className="bg-accent/10 text-accent border-accent/30 px-3 py-1">
              <CheckCircle className="w-3 h-3 mr-1" />
              Settled: {marketStatus?.winning_outcome === 0 ? 'Team A' : marketStatus?.winning_outcome === 1 ? 'Team B' : 'Draw'}
            </Badge>
            <Button onClick={() => onSettle(bet, bet.winning_outcome === 'a' || bet.winning_outcome === 'team_a' ? 'a' : bet.winning_outcome === 'b' || bet.winning_outcome === 'team_b' ? 'b' : 'draw')} disabled={!walletAddress} size="sm" className="h-8 text-xs bg-accent/20 hover:bg-accent/30 text-accent border border-accent/30 rounded-lg">
              <RefreshCcw className="w-3 h-3 mr-1" /> Re-settle On-Chain
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => onSettle(bet, 'a')} disabled={!walletAddress} size="sm" className="flex-1 h-8 text-xs bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-lg">
              Settle A
            </Button>
            <Button onClick={() => onSettle(bet, 'b')} disabled={!walletAddress} size="sm" className="flex-1 h-8 text-xs bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-lg">
              Settle B
            </Button>
            <Button onClick={() => onSettle(bet, 'draw')} disabled={!walletAddress} size="sm" className="flex-1 h-8 text-xs bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-lg">
              Settle Draw
            </Button>
            <Button onClick={() => onVoid(bet)} disabled={!walletAddress} size="sm" variant="outline" className="h-8 text-xs border-destructive/30 text-destructive hover:bg-destructive/10 rounded-lg">
              Void
            </Button>
          </>
        )}
      </div>
    </div>
  );
}