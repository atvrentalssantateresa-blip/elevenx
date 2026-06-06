import React, { useState } from 'react';
import { useWallet } from '@/lib/WalletContext';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, AlertCircle, CheckCircle, Activity } from 'lucide-react';

export default function DebugClaim() {
  const { isConnected, walletAddress } = useWallet();
  const [testBetId, setTestBetId] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [placingBet, setPlacingBet] = useState(false);

  const handlePlaceTestBet = async () => {
    if (!walletAddress) {
      setError('Please connect your wallet first');
      return;
    }

    setPlacingBet(true);
    setError(null);

    try {
      // Find the test match
      const matches = await base44.entities.Match.list();
      const testMatch = matches.find(m => m.title?.includes('Quick Test'));
      
      if (!testMatch) {
        setError('No test match found. Please create a test match first.');
        setPlacingBet(false);
        return;
      }

      // Find an existing bet offer for this match
      const offers = await base44.entities.BetOffer.list();
      const validOffer = offers.find(o => 
        o.match_id === testMatch.id && 
        o.status === 'open' &&
        (o.amount_unmatched || 0) > 0
      );

      if (!validOffer) {
        setError('No available offers to match. Please wait for LP to provide liquidity.');
        setPlacingBet(false);
        return;
      }

      // Place a small test bet (0.001 SOL)
      const res = await base44.functions.invoke('matchBet', {
        offerId: validOffer.id,
        amount: 0.001,
        walletAddress: walletAddress,
      });

      if (res.data.error) {
        throw new Error(res.data.error);
      }

      setResult({
        message: '✅ Test bet placed successfully!',
        bet: res.data.userBet,
        instruction: res.data.solana_instruction,
      });

    } catch (err) {
      console.error('[DebugClaim] Place bet error:', err);
      setError('Failed to place bet: ' + err.message);
    } finally {
      setPlacingBet(false);
    }
  };

  const handleTestClaim = async () => {
    if (!walletAddress) {
      setError('Please connect your wallet first');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Fetch UserBets for this wallet
      const allBets = await base44.entities.UserBet.list('-created_date', 100);
      const myBets = allBets.filter(bet => bet.wallet_address === walletAddress);
      
      console.log('[DebugClaim] My bets:', myBets);
      
      // Find a won bet that hasn't been claimed
      const claimableBet = myBets.find(bet => 
        bet.status === 'won' && !bet.actual_payout
      );

      if (!claimableBet) {
        setError('No claimable bets found. Place a bet and wait for the match to settle.');
        setLoading(false);
        return;
      }

      setResult({
        message: 'Found claimable bet!',
        bet: claimableBet,
        myBetsCount: myBets.length,
      });

      setTestBetId(claimableBet.id);

    } catch (err) {
      console.error('[DebugClaim] Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForceClaim = async () => {
    if (!testBetId) return;

    try {
      const res = await base44.functions.invoke('claimWinnings', {
        userBetId: testBetId,
        walletAddress: walletAddress,
      });

      setResult(prev => ({
        ...prev,
        claimResponse: res.data,
        message: 'Claim executed! Check response below.',
      }));

    } catch (err) {
      setError('Claim failed: ' + err.message);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <Trophy className="w-5 h-5 text-accent" />
            Debug Claim - Test Betting Wallet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-secondary/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Current Wallet:</p>
            <p className="font-mono text-sm font-bold">
              {walletAddress ? walletAddress.slice(0, 8) + '...' + walletAddress.slice(-8) : 'Not connected'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Status: {isConnected ? '✅ Connected' : '❌ Disconnected'}
            </p>
          </div>

          <div className="space-y-3">
            <Button 
              onClick={handlePlaceTestBet} 
              disabled={!isConnected || placingBet}
              className="w-full"
            >
              {placingBet ? 'Placing Bet...' : '🎯 Place Test Bet (0.001 SOL)'}
            </Button>

            <Button 
              onClick={handleTestClaim} 
              disabled={!isConnected || loading}
              className="w-full"
            >
              {loading ? 'Checking...' : '🔍 Find My Bets & Claimable'}
            </Button>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-destructive mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {result && (
            <div className="space-y-3">
              {result.bet && result.instruction && (
                <div className="bg-primary/10 border border-primary/30 rounded-lg p-3">
                  <p className="text-sm font-bold text-primary mb-2">📝 Test Bet Created</p>
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Match:</span>
                      <span>{result.bet.match_title}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Outcome:</span>
                      <span>{result.bet.outcome_label}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount:</span>
                      <span>◎{result.bet.amount?.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <span className="text-yellow-400">Pending Signature</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">⚠️ Sign the transaction to complete the bet</p>
                </div>
              )}

              <div className="bg-accent/10 border border-accent/30 rounded-lg p-3">
                <p className="text-sm font-bold text-accent mb-2">{result.message}</p>
                <p className="text-xs text-muted-foreground">Total bets for this wallet: {result.myBetsCount}</p>
                
                {result.bet && (
                  <div className="mt-3 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Bet ID:</span>
                      <span className="font-mono">{result.bet.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Match:</span>
                      <span>{result.bet.match_title}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Outcome:</span>
                      <span>{result.bet.outcome_label}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount:</span>
                      <span>◎{result.bet.amount?.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Potential Payout:</span>
                      <span>◎{result.bet.potential_payout?.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge status={result.bet.status} />
                    </div>
                  </div>
                )}
              </div>

              {result.bet && result.bet.status === 'won' && !result.bet.actual_payout && (
                <Button 
                  onClick={handleForceClaim}
                  className="w-full bg-accent hover:bg-accent/90"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Test Claim Winnings (◎{result.bet.potential_payout?.toFixed(4)})
                </Button>
              )}

              {result.claimResponse && (
                <div className="bg-primary/10 border border-primary/30 rounded-lg p-3">
                  <p className="text-sm font-bold text-primary mb-2">Claim Response:</p>
                  <pre className="text-xs text-muted-foreground overflow-auto max-h-40">
                    {JSON.stringify(result.claimResponse, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Badge({ status }) {
  const colors = {
    active: 'bg-primary/10 text-primary',
    pending: 'bg-yellow-500/10 text-yellow-400',
    won: 'bg-accent/20 text-accent',
    lost: 'bg-destructive/10 text-destructive',
    claimed: 'bg-accent/20 text-accent',
    refunded: 'bg-secondary text-secondary-foreground',
    void: 'bg-muted text-muted-foreground',
  };
  
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${colors[status] || colors.void}`}>
      {status}
    </span>
  );
}