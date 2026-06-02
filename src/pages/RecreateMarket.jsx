import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader, AlertCircle, CheckCircle, RefreshCcw } from 'lucide-react';
import RecreateMarketButton from '@/components/admin/RecreateMarketButton';
import { Link } from 'react-router-dom';

export default function RecreateMarket() {
  const { data: bets, isLoading } = useQuery({
    queryKey: ['bets'],
    queryFn: () => base44.entities.Bet.list(),
  });

  const openBets = bets?.filter(b => b.status === 'open') || [];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-heading font-bold">Recreate Markets</h1>
            <p className="text-muted-foreground mt-1">Fix Error 6004 by recreating markets with correct outcome_count=3</p>
            <p className="text-xs text-yellow-500 mt-2">⚠️ If this page doesn't load, go to Admin panel and look for the "Recreate Market" button next to each bet.</p>
          </div>
          <Link to="/admin">
            <Button variant="outline">← Back to Admin</Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : openBets.length === 0 ? (
          <Alert>
            <CheckCircle className="w-4 h-4 text-accent" />
            <AlertDescription className="text-sm">
              No open bets found. All markets may already be properly configured.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="grid gap-4">
            {openBets.map((bet) => (
              <Card key={bet.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{bet.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Match ID:</span>
                      <span className="font-mono text-xs">{bet.match_id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <span className="text-accent font-medium">{bet.status}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Outcomes:</span>
                      <span className="text-xs font-mono">
                        {bet.outcome_a} vs {bet.outcome_b} (Draw)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Odds:</span>
                      <span className="text-xs font-mono">
                        A: {(bet.odds_a || 0).toFixed(2)}x | B: {(bet.odds_b || 0).toFixed(2)}x | Draw: {(bet.odds_draw || 0).toFixed(2)}x
                      </span>
                    </div>
                  </div>

                  <RecreateMarketButton
                    bet={bet}
                    match_id={bet.match_id}
                    onSuccess={(status) => {
                      console.log('Market recreated successfully:', status);
                    }}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Alert className="border-blue-500/50 bg-blue-500/10">
          <AlertCircle className="w-4 h-4 text-blue-500" />
          <AlertDescription className="text-sm text-blue-500">
            <strong>Why recreate?</strong> Error 6004 occurs when a market was initialized with outcome_count=0 (default) instead of 3. 
            Recreating fixes this by setting outcome_count=3, allowing all three outcomes (a, b, draw) to be used.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}