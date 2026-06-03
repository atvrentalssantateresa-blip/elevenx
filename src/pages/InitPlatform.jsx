import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useWallet } from '@/lib/WalletContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import SolanaTransactionSigner from '@/components/wallet/SolanaTransactionSigner';

export default function InitPlatform() {
  const { isConnected, connect } = useWallet();
  const [instruction, setInstruction] = useState(null);
  const [error, setError] = useState(null);

  const { data: platformStatus } = useQuery({
    queryKey: ['platformStatus'],
    queryFn: () => base44.functions.invoke('checkPlatformConfig', {}),
  });

  const handleInit = async () => {
    try {
      const res = await base44.functions.invoke('initPlatformConfig', {});
      if (res.data.error) throw new Error(res.data.error);
      setInstruction(res.data.solana_instruction);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSuccess = () => {
    setInstruction(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="font-heading font-bold text-2xl">Platform Initialization</h1>
        
        {platformStatus?.data?.initialized ? (
          <Card className="bg-accent/10 border-accent/30">
            <CardContent className="p-6 flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-accent" />
              <div>
                <p className="font-bold text-accent">Platform is initialized</p>
                <p className="text-sm text-muted-foreground">
                  Fee Vault: {platformStatus.data.feeVaultPda?.slice(0, 8)}...
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-destructive/10 border-destructive/30">
            <CardContent className="p-6 flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-destructive" />
              <div>
                <p className="font-bold text-destructive">Platform not initialized</p>
                <p className="text-sm text-muted-foreground">
                  Markets cannot be created until platform config is set up
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="bg-destructive/10 border-destructive/30">
            <CardContent className="p-4">
              <p className="text-destructive text-sm">{error}</p>
            </CardContent>
          </Card>
        )}

        {instruction ? (
          <SolanaTransactionSigner
            instruction={instruction}
            amount="0"
            isPlatformInit={true}
            onSuccess={handleSuccess}
            onError={() => setError('Transaction failed')}
          />
        ) : (
          <Button
            onClick={handleInit}
            disabled={!isConnected}
            className="w-full h-12"
          >
            {!isConnected ? (
              <>Connect Wallet First</>
            ) : (
              <>Initialize Platform</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}