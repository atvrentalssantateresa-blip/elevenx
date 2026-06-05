import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AdminBetRow from '@/components/admin/AdminBetRow';
import AdminFuturesPanel from '@/components/admin/AdminFuturesPanel';
import SolanaTransactionSigner from '@/components/wallet/SolanaTransactionSigner';
import { AlertCircle, Loader, List, TrendingUp, Database, Settings } from 'lucide-react';

export default function Admin() {
  const [walletAddress, setWalletAddress] = useState(null);
  const [activeTab, setActiveTab] = useState('bets');
  const [settleDialog, setSettleDialog] = useState(null);
  const [voidDialog, setVoidDialog] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const stored = localStorage.getItem('elevenx_wallet_session');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        setWalletAddress(data.address);
      } catch (e) {
        console.error('[Admin] Failed to parse wallet:', e);
      }
    }
  }, []);

  const { data: allBets = [], isLoading: isLoadingBets } = useQuery({
    queryKey: ['allBets'],
    queryFn: async () => {
      const bets = await base44.entities.Bet.list();
      return bets;
    },
  });

  const { data: allMatches = {} } = useQuery({
    queryKey: ['allMatches'],
    queryFn: async () => {
      const matches = await base44.entities.Match.list();
      const matchMap = {};
      matches.forEach(m => {
        matchMap[m.id] = m;
      });
      return matchMap;
    },
  });

  const handleSettle = async (bet, outcome) => {
    if (!walletAddress) return;
    try {
      const res = await base44.functions.invoke('settleMarketOnChain', {
        bet_id: bet.id,
        winning_outcome: outcome,
        admin_wallet: walletAddress,
      });

      if (res.data.error) {
        alert('Error: ' + res.data.error);
        return;
      }

      setSettleDialog({
        instruction: res.data.solana_instruction,
        bet,
        outcome,
      });
    } catch (err) {
      alert('Failed to prepare settlement: ' + err.message);
    }
  };

  const handleVoid = async (bet) => {
    if (!walletAddress) return;
    try {
      const res = await base44.functions.invoke('settleMarketOnChain', {
        bet_id: bet.id,
        winning_outcome: 'void',
        admin_wallet: walletAddress,
      });

      if (res.data.error) {
        alert('Error: ' + res.data.error);
        return;
      }

      setVoidDialog({
        instruction: res.data.solana_instruction,
        bet,
      });
    } catch (err) {
      alert('Failed to prepare void: ' + err.message);
    }
  };

  const handleSettleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['allBets'] });
    setSettleDialog(null);
  };

  const handleVoidSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['allBets'] });
    setVoidDialog(null);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="font-heading font-bold text-3xl text-white mb-2">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">Manage betting markets and settlements</p>
        </div>

        <Card className="bg-card/50 border-border/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Connected Wallet</p>
              <p className="font-mono text-sm text-white">{walletAddress ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-8)}` : 'Not connected'}</p>
            </div>
            <Badge variant={walletAddress ? 'default' : 'outline'}>
              {walletAddress ? '✓ Connected' : '✗ Disconnected'}
            </Badge>
          </div>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-secondary/20 border border-border/50 rounded-xl p-1">
            <TabsTrigger value="bets" className="data-[state=active]:bg-primary data-[state=active]:text-white rounded-lg">
              <List className="w-4 h-4 mr-2" />
              Bets
            </TabsTrigger>
            <TabsTrigger value="futures" className="data-[state=active]:bg-accent data-[state=active]:text-white rounded-lg">
              <TrendingUp className="w-4 h-4 mr-2" />
              Futures
            </TabsTrigger>
            <TabsTrigger value="actions" className="data-[state=active]:bg-primary data-[state=active]:text-white rounded-lg">
              <Database className="w-4 h-4 mr-2" />
              Actions
            </TabsTrigger>
            <TabsTrigger value="platform" className="data-[state=active]:bg-secondary data-[state=active]:text-white rounded-lg">
              <Settings className="w-4 h-4 mr-2" />
              Platform
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bets" className="mt-4">
            <Card className="bg-card/50 border-border/50 p-4">
              <h2 className="font-heading font-bold text-xl text-white mb-4">Betting Markets ({allBets.length})</h2>
              
              {isLoadingBets ? (
                <div className="flex items-center justify-center py-12">
                  <Loader className="w-6 h-6 animate-spin text-primary mr-2" />
                  <span className="text-muted-foreground">Loading bets...</span>
                </div>
              ) : allBets.length === 0 ? (
                <div className="flex items-center gap-3 py-6">
                  <AlertCircle className="w-5 h-5 text-muted-foreground" />
                  <p className="text-muted-foreground">No bets found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {allBets.map((bet) => (
                    <div key={bet.id} className="border border-border/30 rounded-lg p-3">
                      <AdminBetRow
                        bet={bet}
                        match={allMatches[bet.match_id]}
                        onSettle={handleSettle}
                        onVoid={handleVoid}
                      />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="futures" className="mt-4">
            <AdminFuturesPanel walletAddress={walletAddress} />
          </TabsContent>

          <TabsContent value="actions" className="mt-4">
            <Card className="bg-card/50 border-border/50 p-6">
              <h2 className="font-heading font-bold text-xl text-white mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Button
                  onClick={async () => {
                    try {
                      await base44.functions.invoke('createQuickTestMatch');
                      alert('✓ Test match created!');
                      queryClient.invalidateQueries({ queryKey: ['allBets'] });
                    } catch (err) {
                      alert('Error: ' + err.message);
                    }
                  }}
                  className="h-24 flex flex-col gap-2 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-xl"
                >
                  <span className="font-bold text-lg">⚡ Create Quick Test</span>
                  <span className="text-xs text-muted-foreground">Instant match + bet</span>
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      await base44.functions.invoke('bulkDeployMatches');
                      alert('✓ Matches deployed!');
                      queryClient.invalidateQueries({ queryKey: ['allBets'] });
                    } catch (err) {
                      alert('Error: ' + err.message);
                    }
                  }}
                  className="h-24 flex flex-col gap-2 bg-accent/10 hover:bg-accent/20 border border-accent/30 rounded-xl"
                >
                  <span className="font-bold text-lg">🚀 Bulk Deploy</span>
                  <span className="text-xs text-muted-foreground">All matches</span>
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      await base44.functions.invoke('syncWorldCupMatches');
                      alert('✓ World Cup synced!');
                      queryClient.invalidateQueries({ queryKey: ['allBets'] });
                    } catch (err) {
                      alert('Error: ' + err.message);
                    }
                  }}
                  className="h-24 flex flex-col gap-2 bg-secondary/20 hover:bg-secondary/30 border border-secondary/40 rounded-xl"
                >
                  <span className="font-bold text-lg">🌍 Sync World Cup</span>
                  <span className="text-xs text-muted-foreground">Fetch from API</span>
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      await base44.functions.invoke('bulkDeployFutures');
                      alert('✓ Futures deployed!');
                    } catch (err) {
                      alert('Error: ' + err.message);
                    }
                  }}
                  className="h-24 flex flex-col gap-2 bg-secondary/20 hover:bg-secondary/30 border border-secondary/40 rounded-xl"
                >
                  <span className="font-bold text-lg">📊 Deploy Futures</span>
                  <span className="text-xs text-muted-foreground">All countries</span>
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      await base44.functions.invoke('createTestBetWithLiveOdds');
                      alert('✓ Test bet with live odds created!');
                      queryClient.invalidateQueries({ queryKey: ['allBets'] });
                    } catch (err) {
                      alert('Error: ' + err.message);
                    }
                  }}
                  className="h-24 flex flex-col gap-2 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-xl"
                >
                  <span className="font-bold text-lg">📈 Live Odds Bet</span>
                  <span className="text-xs text-muted-foreground">Real API odds</span>
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      await base44.functions.invoke('createTestBetWithApiMatch');
                      alert('✓ API match bet created!');
                      queryClient.invalidateQueries({ queryKey: ['allBets'] });
                    } catch (err) {
                      alert('Error: ' + err.message);
                    }
                  }}
                  className="h-24 flex flex-col gap-2 bg-accent/10 hover:bg-accent/20 border border-accent/30 rounded-xl"
                >
                  <span className="font-bold text-lg">🎯 API Match</span>
                  <span className="text-xs text-muted-foreground">Real match data</span>
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      await base44.functions.invoke('resetAndSync');
                      alert('✓ Database reset & synced!');
                      queryClient.invalidateQueries({ queryKey: ['allBets'] });
                    } catch (err) {
                      alert('Error: ' + err.message);
                    }
                  }}
                  className="h-24 flex flex-col gap-2 bg-destructive/10 hover:bg-destructive/20 border border-destructive/30 rounded-xl"
                >
                  <span className="font-bold text-lg">🔄 Reset & Sync</span>
                  <span className="text-xs text-muted-foreground">Clear all data</span>
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      await base44.functions.invoke('clearDatabase');
                      alert('✓ Database cleared!');
                      queryClient.invalidateQueries({ queryKey: ['allBets'] });
                    } catch (err) {
                      alert('Error: ' + err.message);
                    }
                  }}
                  className="h-24 flex flex-col gap-2 bg-destructive/10 hover:bg-destructive/20 border border-destructive/30 rounded-xl"
                >
                  <span className="font-bold text-lg">🗑️ Clear DB</span>
                  <span className="text-xs text-muted-foreground">Delete everything</span>
                </Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="platform" className="mt-4">
            <Card className="bg-card/50 border-border/50 p-6">
              <h2 className="font-heading font-bold text-xl text-white mb-4">Platform Settings</h2>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={async () => {
                    try {
                      await base44.functions.invoke('initPlatformConfig');
                      alert('✓ Platform initialized!');
                    } catch (err) {
                      alert('Error: ' + err.message);
                    }
                  }}
                  className="h-16 bg-secondary/20 hover:bg-secondary/30 border border-secondary/40 rounded-xl"
                >
                  Init Platform
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      await base44.functions.invoke('checkPlatformConfig');
                      alert('✓ Config checked!');
                    } catch (err) {
                      alert('Error: ' + err.message);
                    }
                  }}
                  className="h-16 bg-secondary/20 hover:bg-secondary/30 border border-secondary/40 rounded-xl"
                >
                  Check Config
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      await base44.functions.invoke('debugPlatformAdmin');
                      alert('✓ Debug complete!');
                    } catch (err) {
                      alert('Error: ' + err.message);
                    }
                  }}
                  className="h-16 bg-secondary/20 hover:bg-secondary/30 border border-secondary/40 rounded-xl"
                >
                  Debug Admin
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      await base44.functions.invoke('comprehensivePlatformTest');
                      alert('✓ Test complete!');
                    } catch (err) {
                      alert('Error: ' + err.message);
                    }
                  }}
                  className="h-16 bg-secondary/20 hover:bg-secondary/30 border border-secondary/40 rounded-xl"
                >
                  Full Test
                </Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {settleDialog && (
          <Card className="bg-card border-border p-6 fixed inset-4 z-50 max-w-lg mx-auto my-auto">
            <div className="space-y-4">
              <h3 className="font-heading font-bold text-lg text-white">Settle Market</h3>
              <p className="text-sm text-muted-foreground">Outcome: <span className="text-primary font-bold">{settleDialog.outcome.toUpperCase()}</span></p>
              <SolanaTransactionSigner
                instruction={settleDialog.instruction}
                amount={0}
                onSuccess={handleSettleSuccess}
                onError={(err) => console.error('[Admin] Settlement failed:', err)}
              />
              <Button
                onClick={() => setSettleDialog(null)}
                variant="outline"
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          </Card>
        )}

        {voidDialog && (
          <Card className="bg-card border-border p-6 fixed inset-4 z-50 max-w-lg mx-auto my-auto">
            <div className="space-y-4">
              <h3 className="font-heading font-bold text-lg text-white">Void Market</h3>
              <p className="text-sm text-muted-foreground">This will refund all bettors</p>
              <SolanaTransactionSigner
                instruction={voidDialog.instruction}
                amount={0}
                onSuccess={handleVoidSuccess}
                onError={(err) => console.error('[Admin] Void failed:', err)}
              />
              <Button
                onClick={() => setVoidDialog(null)}
                variant="outline"
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}