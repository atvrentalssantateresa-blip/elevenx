import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useWallet } from '@/lib/WalletContext';
import { Button } from '@/components/ui/button';

export default function DebugUserBets() {
  const { walletAddress } = useWallet();
  const [userBets, setUserBets] = useState([]);
  const [lpBets, setLpBets] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchBets = async () => {
    setLoading(true);
    console.log('Fetching UserBets for wallet:', walletAddress);
    
    const all = await base44.entities.UserBet.list('-created_date', 200);
    console.log('Total UserBets:', all.length);
    
    const myLpBets = all.filter(ub => ub.wallet_address === walletAddress && ub.role === 'lp');
    console.log('My LP Bets:', myLpBets.length, myLpBets);
    
    setUserBets(all);
    setLpBets(myLpBets);
    setLoading(false);
  };

  useEffect(() => {
    if (walletAddress) {
      fetchBets();
    }
  }, [walletAddress]);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Debug UserBets</h1>
      <p className="text-sm text-muted-foreground">Wallet: {walletAddress}</p>
      
      <Button onClick={fetchBets} disabled={loading}>
        {loading ? 'Loading...' : 'Refresh'}
      </Button>

      <div className="space-y-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="font-bold text-lg mb-2">My LP Bets (role='lp')</h2>
          <p className="text-sm text-muted-foreground mb-3">Count: {lpBets.length}</p>
          {lpBets.length === 0 ? (
            <p className="text-destructive text-sm">No LP bets found! This is the problem.</p>
          ) : (
            <pre className="text-xs font-mono bg-background p-3 rounded overflow-auto max-h-96">
              {JSON.stringify(lpBets.map(b => ({
                id: b.id,
                bet_id: b.bet_id,
                match_id: b.match_id,
                offer_id: b.offer_id,
                role: b.role,
                amount: b.amount,
                liquidity_deposited: b.liquidity_deposited,
                liquidity_matched: b.liquidity_matched,
                liquidity_unmatched: b.liquidity_unmatched,
                status: b.status,
                outcome: b.outcome,
              })), null, 2)}
            </pre>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="font-bold text-lg mb-2">All My UserBets</h2>
          <p className="text-sm text-muted-foreground mb-3">Count: {userBets.filter(b => b.wallet_address === walletAddress).length}</p>
          <pre className="text-xs font-mono bg-background p-3 rounded overflow-auto max-h-96">
            {JSON.stringify(userBets.filter(b => b.wallet_address === walletAddress).map(b => ({
              id: b.id,
              role: b.role,
              amount: b.amount,
              offer_id: b.offer_id,
            })), null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}