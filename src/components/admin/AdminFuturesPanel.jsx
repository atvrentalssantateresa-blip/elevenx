import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Target, CheckCircle, Zap, Loader, Globe } from 'lucide-react';
import { motion } from 'framer-motion';
import SolanaTransactionSigner from '@/components/wallet/SolanaTransactionSigner';

// Pre-set timeline (Costa Rica time: America/Costa_Rica, UTC-6)
const BETTING_CLOSES = '2026-07-19T13:00:00'; // 1:00 PM local time
const SETTLEMENT_OPENS = '2026-07-19T15:00:00'; // 3:00 PM local time

const TWO_MARKETS_CONFIG = [
  {
    id: 'wc-winner',
    title: 'World Cup Winner',
    subtitle: 'Who will lift the trophy?',
    icon: '🏆',
    tabValue: 'winner',
    category: 'tournament',
  },
  {
    id: 'to-final',
    title: 'To Reach Final',
    subtitle: 'Teams that will make it to the championship match',
    icon: '🎯',
    tabValue: 'final',
    category: 'tournament',
  },
];

export default function AdminFuturesPanel() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('winner');
  const [pendingInit, setPendingInit] = useState(null);

  // Fetch existing futures markets
  const { data: futuresMarkets = [], refetch } = useQuery({
    queryKey: ['futuresMarkets'],
    queryFn: () => base44.entities.FuturesMarket.list('-created_date', 10),
  });

  // Fetch synced matches to get countries with odds from API
  const { data: matches = [] } = useQuery({
    queryKey: ['matches'],
    queryFn: () => base44.entities.Match.list('-created_date', 200),
  });

  // Extract unique countries from matches (team_a and team_b)
  const countries = useMemo(() => {
    const countrySet = new Set();
    matches.forEach(m => {
      if (m.team_a) countrySet.add(m.team_a);
      if (m.team_b) countrySet.add(m.team_b);
    });
    return Array.from(countrySet).sort();
  }, [matches]);

  // Find existing market for current tab
  const currentMarketConfig = TWO_MARKETS_CONFIG.find(m => m.tabValue === activeTab);
  const existingMarket = futuresMarkets.find(f => 
    f.title === currentMarketConfig?.title || 
    (currentMarketConfig?.id === 'wc-winner' && f.title.includes('Winner')) ||
    (currentMarketConfig?.id === 'to-final' && f.title.includes('Final'))
  );

  const createMarketMutation = useMutation({
    mutationFn: async () => {
      // Build outcomes from countries with odds from API
      const outcomes = countries.map(country => ({
        label: country,
        flag: '', // Will be populated from team flags
        odds: 10.0, // Default odds - will be fetched from API
        pool: 0,
        lp_offers: 0,
      }));

      const marketData = {
        title: currentMarketConfig.title,
        subtitle: currentMarketConfig.subtitle,
        category: currentMarketConfig.category,
        icon: currentMarketConfig.icon,
        status: 'coming_soon',
        open_until: new Date(BETTING_CLOSES).toISOString(),
        outcomes,
        total_volume: 0,
        solana_market_created: false,
        solana_market_pda: null,
      };

      const created = await base44.entities.FuturesMarket.create(marketData);
      return created;
    },
    onSuccess: async (createdMarket) => {
      const res = await base44.functions.invoke('createFuturesMarketOnChain', {
        futures_market_id: createdMarket.id,
      });
      
      if (res.data.error) throw new Error(res.data.error);
      
      if (res.data.solana_instruction) {
        setPendingInit(res.data.solana_instruction);
      } else if (res.data.alreadyExists) {
        alert('Market already exists on-chain!');
        refetch();
      }
    },
  });

  const handleInitSuccess = () => {
    setPendingInit(null);
    refetch();
    alert('Futures market initialized on Solana!');
  };

  const isMarketInitialized = existingMarket?.solana_market_created || existingMarket?.solana_market_pda;

  return (
    <div className="space-y-4">
      {/* Timeline Info */}
      <div className="bg-accent/10 border border-accent/20 rounded-xl p-4">
        <p className="text-sm font-bold text-accent mb-1">📅 Pre-set Timeline (Costa Rica Time)</p>
        <p className="text-xs text-muted-foreground">
          • <strong>Betting Closes:</strong> July 19, 2026 at 1:00 PM<br/>
          • <strong>Settlement Opens:</strong> July 19, 2026 at 3:00 PM
        </p>
      </div>

      {/* Countries Count */}
      <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Globe className="w-5 h-5 text-primary" />
          <div>
            <p className="text-sm font-bold text-foreground">Synced Countries</p>
            <p className="text-xs text-muted-foreground">From TheStatsAPI matches</p>
          </div>
        </div>
        <Badge className="bg-primary text-primary-foreground font-bold">
          {countries.length} Countries
        </Badge>
      </div>

      {/* Two Markets Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-secondary/50 border border-border/50 rounded-xl p-1">
          <TabsTrigger 
            value="winner" 
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-bold rounded-lg transition-all flex items-center gap-2"
          >
            <Trophy className="w-4 h-4" />
            World Cup Winner
          </TabsTrigger>
          <TabsTrigger 
            value="final" 
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-bold rounded-lg transition-all flex items-center gap-2"
          >
            <Target className="w-4 h-4" />
            To Reach Final
          </TabsTrigger>
        </TabsList>

        <TabsContent value="winner" className="mt-4">
          <MarketPanel 
            marketConfig={TWO_MARKETS_CONFIG[0]}
            countries={countries}
            existingMarket={existingMarket}
            isInitialized={isMarketInitialized}
            onCreate={() => createMarketMutation.mutate()}
            isLoading={createMarketMutation.isPending}
            pendingInit={pendingInit}
            onInitSuccess={handleInitSuccess}
            onCancelInit={() => setPendingInit(null)}
          />
        </TabsContent>

        <TabsContent value="final" className="mt-4">
          <MarketPanel 
            marketConfig={TWO_MARKETS_CONFIG[1]}
            countries={countries}
            existingMarket={existingMarket}
            isInitialized={isMarketInitialized}
            onCreate={() => createMarketMutation.mutate()}
            isLoading={createMarketMutation.isPending}
            pendingInit={pendingInit}
            onInitSuccess={handleInitSuccess}
            onCancelInit={() => setPendingInit(null)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MarketPanel({ 
  marketConfig, 
  countries, 
  existingMarket, 
  isInitialized, 
  onCreate, 
  isLoading,
  pendingInit,
  onInitSuccess,
  onCancelInit,
}) {
  return (
    <div className="space-y-3">
      {/* Market Header */}
      <div className="bg-card border border-border/50 rounded-xl p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{marketConfig.icon}</span>
            <div>
              <h3 className="font-heading font-bold text-base">{marketConfig.title}</h3>
              <p className="text-xs text-muted-foreground">{marketConfig.subtitle}</p>
            </div>
          </div>
          {isInitialized && (
            <Badge className="bg-accent/20 text-accent text-xs py-1 px-3 rounded-lg">
              <CheckCircle className="w-3 h-3 mr-1" /> On-Chain
            </Badge>
          )}
        </div>
      </div>

      {/* Countries List */}
      <div className="bg-card border border-border/50 rounded-xl p-4 max-h-96 overflow-y-auto">
        <h4 className="font-heading font-bold text-sm mb-3">All {countries.length} Countries</h4>
        <div className="grid grid-cols-2 gap-2">
          {countries.map((country, i) => (
            <div 
              key={country}
              className="flex items-center gap-2 p-2 bg-secondary/30 rounded-lg border border-border/30"
            >
              <span className="text-xs font-medium truncate">{country}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Action Button */}
      {pendingInit ? (
        <div className="space-y-3">
          <div className="bg-primary/10 border border-primary/30 rounded-xl p-4">
            <p className="text-sm font-bold text-primary mb-1">Sign Transaction</p>
            <p className="text-xs text-muted-foreground">Deploy all {countries.length} countries to Solana</p>
          </div>
          <SolanaTransactionSigner
            instruction={pendingInit}
            amount={0}
            onSuccess={onInitSuccess}
          />
          <Button variant="outline" size="sm" onClick={onCancelInit} className="w-full">
            Cancel
          </Button>
        </div>
      ) : isInitialized ? (
        <div className="bg-accent/10 border border-accent/30 rounded-xl p-4 text-center">
          <p className="text-xs text-accent font-bold">✓ Market Initialized on Solana</p>
          <p className="text-[10px] text-accent/80 mt-1">All {countries.length} countries deployed with odds</p>
        </div>
      ) : (
        <Button
          onClick={onCreate}
          disabled={countries.length === 0 || isLoading}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-heading font-bold rounded-xl h-11"
        >
          {isLoading ? (
            <>
              <Loader className="w-4 h-4 mr-2 animate-spin" />
              Creating Market...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 mr-2" />
              Initialize All {countries.length} Countries on Solana
            </>
          )}
        </Button>
      )}
    </div>
  );
}