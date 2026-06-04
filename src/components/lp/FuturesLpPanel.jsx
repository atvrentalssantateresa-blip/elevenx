import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, DollarSign, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function FuturesLpPanel({ 
  futuresMarkets, 
  onProvideLiquidity, 
  isConnected,
  connect 
}) {
  const [selectedOutcome, setSelectedOutcome] = React.useState(null);

  // Flatten all outcomes from all markets
  const allOutcomes = React.useMemo(() => {
    const outcomes = [];
    futuresMarkets.forEach(market => {
      if (market.status === 'open' || market.status === 'coming_soon') {
        market.outcomes.forEach(outcome => {
          outcomes.push({
            ...outcome,
            market_id: market.id,
            market_title: market.title,
            market_category: market.category,
            market_icon: market.icon,
            open_until: market.open_until,
          });
        });
      }
    });
    return outcomes;
  }, [futuresMarkets]);

  const tournamentOutcomes = allOutcomes.filter(o => o.market_category === 'tournament');
  const playerOutcomes = allOutcomes.filter(o => o.market_category === 'player');

  if (!isConnected) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-primary/20 p-8 text-center"
        style={{ background: 'linear-gradient(145deg, #1a1040 0%, #0f0a1e 100%)' }}>
        <Trophy className="w-12 h-12 text-primary mx-auto mb-4" />
        <h3 className="font-heading font-black text-xl text-white mb-2">Connect Wallet for Futures LP</h3>
        <p className="text-white/50 text-sm mb-5 max-w-xs mx-auto">Provide liquidity against tournament outcomes and earn yield.</p>
        <Button onClick={connect} className="font-heading font-bold px-8 h-11 rounded-xl"
          style={{ background: 'linear-gradient(135deg, #a69cf2, #8b84e8)' }}>
          <Trophy className="w-4 h-4 mr-2" /> Connect Phantom
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tournament Winner Cards */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-primary" />
          <h2 className="font-heading font-bold text-base">Tournament Winners</h2>
          <Badge variant="outline" className="text-xs">{tournamentOutcomes.length} outcomes</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tournamentOutcomes.map((outcome, i) => (
            <FuturesOutcomeCard
              key={`${outcome.market_id}-${outcome.label}`}
              outcome={outcome}
              selectedOutcome={selectedOutcome}
              setSelectedOutcome={setSelectedOutcome}
              onProvideLiquidity={onProvideLiquidity}
            />
          ))}
        </div>
      </section>

      {/* Player Awards Cards */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-accent" />
          <h2 className="font-heading font-bold text-base">Player Awards</h2>
          <Badge variant="outline" className="text-xs">{playerOutcomes.length} outcomes</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {playerOutcomes.map((outcome, i) => (
            <FuturesOutcomeCard
              key={`${outcome.market_id}-${outcome.label}`}
              outcome={outcome}
              selectedOutcome={selectedOutcome}
              setSelectedOutcome={setSelectedOutcome}
              onProvideLiquidity={onProvideLiquidity}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function FuturesOutcomeCard({ outcome, selectedOutcome, setSelectedOutcome, onProvideLiquidity }) {
  const [amount, setAmount] = React.useState('');
  const isSelected = selectedOutcome?.label === outcome.label && selectedOutcome?.market_id === outcome.market_id;
  const isExpanded = isSelected || amount > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border-2 overflow-hidden transition-all ${
        isSelected ? 'border-primary bg-primary/5' : 'border-border/50 bg-card hover:border-border'
      }`}
    >
      {/* Card Header with Flag/Icon */}
      <div className="p-4 border-b border-border/30">
        <div className="flex items-start justify-between mb-2">
          <div className="text-4xl">{outcome.flag || '🌍'}</div>
          <Badge className={`${outcome.odds >= 5 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-primary/20 text-primary'}`}>
            {outcome.odds.toFixed(1)}x
          </Badge>
        </div>
        <h3 className="font-heading font-black text-lg">{outcome.label}</h3>
        <p className="text-xs text-muted-foreground mt-1">{outcome.market_title}</p>
      </div>

      {/* LP Provider Section */}
      <div className="p-4 space-y-3">
        {/* Explainer */}
        <div className="bg-secondary/40 rounded-xl p-3 text-xs">
          <p className="font-bold text-foreground mb-1">💰 Be The House</p>
          <p className="text-muted-foreground">
            Provide liquidity <span className="text-destructive font-bold">AGAINST</span> {outcome.label}.
          </p>
          <p className="text-muted-foreground mt-1">
            If they <span className="text-green-400 font-bold">LOSE</span> → You profit.
            If they <span className="text-destructive font-bold">WIN</span> → You pay {outcome.odds.toFixed(1)}x.
          </p>
        </div>

        {/* Amount Input */}
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">LP Amount (SOL)</label>
          <input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-secondary/50 border-border/50 text-lg font-heading font-bold h-11 rounded-xl px-3 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="flex gap-2 mt-2">
            {[0.5, 1, 5, 10].map(qa => (
              <button
                key={qa}
                onClick={() => setAmount(String(qa))}
                className="px-2 py-1 text-xs font-medium bg-secondary hover:bg-secondary/80 rounded-lg flex-1"
              >
                ◎{qa}
              </button>
            ))}
          </div>
        </div>

        {/* Provide LP Button */}
        <Button
          onClick={() => onProvideLiquidity(outcome, parseFloat(amount))}
          disabled={!amount || parseFloat(amount) <= 0}
          className="w-full h-11 font-heading font-bold rounded-xl"
          style={{ background: 'linear-gradient(135deg, #a69cf2, #8b84e8)' }}
        >
          <DollarSign className="w-4 h-4 mr-2" />
          Provide ◎{amount || '0'} LP
        </Button>

        {/* Reset amount after clicking */}
        {amount > 0 && (
          <button
            onClick={() => setAmount('')}
            className="text-xs text-muted-foreground hover:text-foreground mt-2"
          >
            Clear
          </button>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border/30">
          <div>
            <p className="text-[10px] text-muted-foreground">Pool</p>
            <p className="font-bold text-xs">◎{outcome.pool?.toFixed(2) || '0'}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">LP Offers</p>
            <p className="font-bold text-xs">{outcome.lp_offers || 0}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}