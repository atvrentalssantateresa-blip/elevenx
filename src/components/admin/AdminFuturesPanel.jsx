import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, CheckCircle, Zap, Loader, Globe, Rocket } from 'lucide-react';
import SolanaTransactionSigner from '@/components/wallet/SolanaTransactionSigner';

export default function AdminFuturesPanel() {
  const queryClient = useQueryClient();
  const [pendingDeploy, setPendingDeploy] = useState(null);
  const [deployingMarketId, setDeployingMarketId] = useState(null);

  // Fetch existing futures markets (country-by-country)
  const { data: futuresMarkets = [], refetch } = useQuery({
    queryKey: ['futuresMarkets'],
    queryFn: () => base44.entities.FuturesMarket.list('-created_date', 100),
  });

  const handleDeploySuccess = async (result) => {
    console.log('Futures market deploy success:', result);
    
    if (pendingDeploy?.futures_market_id) {
      await base44.entities.FuturesMarket.update(pendingDeploy.futures_market_id, {
        solana_market_created: true,
        solana_market_pda: pendingDeploy.marketPda || result.marketPda,
      });
    }
    
    setPendingDeploy(null);
    setDeployingMarketId(null);
    queryClient.invalidateQueries({ queryKey: ['futuresMarkets'] });
    alert('Country futures market deployed on-chain!');
  };

  const deployMutation = useMutation({
    mutationFn: async (marketId) => {
      const res = await base44.functions.invoke('createFuturesMarketOnChain', {
        futures_market_id: marketId,
      });
      if (res.data.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (data, marketId) => {
      if (data.solana_instruction) {
        setPendingDeploy(data.solana_instruction);
      } else if (data.alreadyExists) {
        alert('Market already exists on-chain!');
        queryClient.invalidateQueries({ queryKey: ['futuresMarkets'] });
      }
    },
  });

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Globe className="w-5 h-5 text-primary" />
          <div>
            <p className="text-sm font-bold text-foreground">Country Futures Markets</p>
            <p className="text-xs text-muted-foreground">Each country has 1st, 2nd, 3rd place outcomes</p>
          </div>
        </div>
        <Badge className="bg-primary text-primary-foreground font-bold">
          {futuresMarkets.length} Markets
        </Badge>
      </div>

      {/* Markets List */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {futuresMarkets.map((market, i) => (
          <div 
            key={market.id}
            className="bg-card border border-border/50 rounded-xl p-4"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/20 flex items-center justify-center text-2xl">
                  {market.country_flag || market.icon || '🌍'}
                </div>
                <div>
                  <h3 className="font-heading font-bold text-sm">{market.country}</h3>
                  <p className="text-xs text-muted-foreground">{market.subtitle}</p>
                </div>
              </div>
              {market.solana_market_created ? (
                <Badge className="bg-accent/20 text-accent text-xs py-1 px-3 rounded-lg">
                  <CheckCircle className="w-3 h-3 mr-1" /> On-Chain
                </Badge>
              ) : (
                <div className="flex items-center gap-2">
                  <Badge className="bg-secondary text-secondary-foreground text-xs py-1 px-3 rounded-lg">
                    Not Deployed
                  </Badge>
                  <Button
                    size="sm"
                    onClick={() => {
                      setDeployingMarketId(market.id);
                      deployMutation.mutate(market.id);
                    }}
                    disabled={deployMutation.isPending || deployingMarketId === market.id}
                    className="bg-primary hover:bg-primary/90 text-xs font-bold h-7 px-2 rounded-lg"
                  >
                    {deployingMarketId === market.id && deployMutation.isPending ? (
                      <Loader className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <Rocket className="w-3 h-3 mr-1" /> Deploy
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Outcomes */}
            <div className="bg-secondary/30 rounded-lg p-3 mt-3">
              <div className="grid grid-cols-3 gap-2">
                {market.outcomes?.map((outcome, idx) => (
                  <div key={idx} className="text-center">
                    <p className="text-[10px] text-muted-foreground">{outcome.position}</p>
                    <p className="font-bold text-xs text-primary">{outcome.odds.toFixed(2)}x</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {futuresMarkets.length === 0 && (
        <div className="text-center py-12">
          <Trophy className="w-12 h-12 text-primary mx-auto mb-4" />
          <h3 className="font-heading font-bold text-lg mb-2">No Country Markets Yet</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Use "Fetch All Odds" to create markets automatically from API data
          </p>
        </div>
      )}

      {/* Deploy Transaction Modal */}
      {pendingDeploy && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border/50 rounded-2xl p-6 max-w-md w-full">
            <div className="space-y-4">
              <div className="bg-primary/10 border border-primary/30 rounded-xl p-4">
                <p className="text-sm font-bold text-primary mb-1">Deploy to Solana</p>
                <p className="text-xs text-muted-foreground">Sign transaction to deploy this country market on-chain</p>
              </div>
              <SolanaTransactionSigner
                instruction={pendingDeploy}
                amount={0}
                futures_market_id={pendingDeploy.futures_market_id}
                onSuccess={handleDeploySuccess}
              />
              <Button variant="outline" size="sm" onClick={() => setPendingDeploy(null)} className="w-full">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}