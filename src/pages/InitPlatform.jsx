import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useWallet } from '@/lib/WalletContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, CheckCircle, AlertTriangle, Key } from 'lucide-react';
import SolanaTransactionSigner from '@/components/wallet/SolanaTransactionSigner';

export default function InitPlatform() {
  const { isConnected, connect } = useWallet();
  const [instruction, setInstruction] = useState(null);
  const [error, setError] = useState(null);
  const { walletAddress } = useWallet();

  const { data: platformStatus } = useQuery({
    queryKey: ['platformStatus'],
    queryFn: () => base44.functions.invoke('checkPlatformConfig', {}),
  });

  const { data: programIdData } = useQuery({
    queryKey: ['programId'],
    queryFn: () => base44.functions.invoke('solanaConfig', {}),
  });

  const handleInit = async () => {
    try {
      if (!walletAddress) {
        throw new Error('Wallet not connected');
      }
      const res = await base44.functions.invoke('reinitPlatformWithWallet', { walletAddress });
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

        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Key className="w-5 h-5 text-primary" />
              <h2 className="font-heading font-bold text-lg">Solana Program ID</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Current program ID being used by the app:
            </p>
            <div className="bg-muted/50 rounded-lg p-3 font-mono text-xs break-all">
              {programIdData?.currentProgramId || 'Loading...'}
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                To update the program ID after deploying a new contract:
              </p>
              <ol className="list-decimal list-inside text-sm space-y-1 text-muted-foreground">
                <li>Go to Dashboard → Code → Secrets</li>
                <li>Update <code className="bg-muted px-1 rounded">SOLANA__PROGRAM_ID</code></li>
                <li>Reload this page to apply changes</li>
              </ol>
            </div>
          </CardContent>
        </Card>

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
            ) : platformStatus?.data?.initialized ? (
              <>Reinitialize Platform (Fix Admin)</>
            ) : (
              <>Initialize Platform</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}