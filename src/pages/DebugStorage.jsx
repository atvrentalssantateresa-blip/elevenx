import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';

export default function DebugStorage() {
  const { user } = useAuth();
  const [walletSession, setWalletSession] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [walletBets, setWalletBets] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const session = localStorage.getItem('elevenx_wallet_session');
    const token = localStorage.getItem('elevenx_auth_token');
    
    setWalletSession(session);
    setAuthToken(token ? '✓ Present' : '✗ Missing');
  }, []);

  const checkWalletBets = async () => {
    setLoading(true);
    try {
      // Get wallet address from storage
      let wallet = walletSession;
      if (wallet) {
        try {
          const parsed = JSON.parse(wallet);
          wallet = parsed.address || wallet;
        } catch {}
      }

      if (!wallet) {
        alert('No wallet session found in localStorage');
        setLoading(false);
        return;
      }

      const res = await base44.functions.invoke('whichWalletHasBets', {});
      
      const betsForThisWallet = res.data.wallets.find(w => w.wallet === wallet);
      setWalletBets({
        wallet,
        bets: betsForThisWallet?.bets || [],
        betCount: betsForThisWallet?.betCount || 0,
      });
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fixWalletSession = async () => {
    // Set the correct wallet from the admin user and fetch fresh auth token
    const correctWallet = '6Bp5RhK8hsVcpBsLq7QyiJfZxTa7jdyFqEpBka7Ut6tN';
    try {
      const res = await base44.functions.invoke('walletAuth', { walletAddress: correctWallet });
      if (res.data.authToken) {
        localStorage.setItem('elevenx_auth_token', res.data.authToken);
        localStorage.setItem('elevenx_wallet_session', JSON.stringify({ address: correctWallet, connectedAt: Date.now() }));
        localStorage.setItem('elevenx_authenticated', 'true');
        alert('✓ Admin session loaded! Reloading...');
        window.location.reload();
      } else {
        alert('Failed to get auth token');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6">
      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle>Storage Debug</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Current User (from Auth):</p>
            <code className="text-xs bg-secondary/50 p-2 rounded block break-all">
              {user ? `${user.id} - ${user.wallet_address}` : 'Not authenticated'}
            </code>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-1">Wallet Session (localStorage):</p>
            <code className="text-xs bg-secondary/50 p-2 rounded block break-all">
              {walletSession || '✗ None'}
            </code>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-1">Auth Token:</p>
            <code className="text-xs bg-secondary/50 p-2 rounded block break-all">
              {authToken}
            </code>
          </div>

          <div className="flex gap-2">
            <Button onClick={checkWalletBets} disabled={loading} variant="outline">
              {loading ? 'Checking...' : 'Check Wallet Bets'}
            </Button>
            <Button onClick={fixWalletSession} variant="outline" className="text-orange-400">
              Fix Wallet Session
            </Button>
          </div>

          {walletBets && (
            <div className="bg-secondary/30 rounded p-3 space-y-2">
              <p className="text-sm font-bold">Wallet: {walletBets.wallet.slice(0, 20)}...</p>
              <p className="text-sm">Bets found: {walletBets.betCount}</p>
              {walletBets.bets.length > 0 && (
                <div className="text-xs space-y-1">
                  {walletBets.bets.map(bet => (
                    <div key={bet.id} className="text-muted-foreground">
                      • {bet.outcome} - ◎{bet.amount} ({bet.status})
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}