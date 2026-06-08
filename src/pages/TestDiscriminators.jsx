import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { useWallet } from '@/lib/WalletContext';
import SolanaTransactionSigner from '@/components/wallet/SolanaTransactionSigner';

const DISCRIMINATORS = [
  { name: 'global:initialize_platform', discriminator: '77c9652d4b7a5903', dataHex: '77c9652d4b7a59030000' },
  { name: 'initialize_platform', discriminator: 'e8e86b916a164627', dataHex: 'e8e86b916a1646270000' },
  { name: 'global:InitializePlatform', discriminator: '872377a5116064b9', dataHex: '872377a5116064b90000' },
  { name: 'InitializePlatform', discriminator: '047509082cb6103b', dataHex: '047509082cb6103b0000' },
  { name: 'global:initializePlatform', discriminator: 'd3407de4ffa9f4c1', dataHex: 'd3407de4ffa9f4c10000' },
  { name: 'initializePlatform', discriminator: '7a6e02c6e319f6ec', dataHex: '7a6e02c6e319f6ec0000' },
];

export default function TestDiscriminators() {
  const [selectedDisc, setSelectedDisc] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const { isConnected } = useWallet();

  const handleTest = async (disc) => {
    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }
    
    setTesting(true);
    setTestResult(null);
    setSelectedDisc(disc);
    
    try {
      const response = await base44.functions.invoke('reinitPlatformWithWallet', {
        walletAddress: window.phantom?.solana?.publicKey?.toBase58(),
      });
      
      if (response.success) {
        // Modify the instruction data with the selected discriminator
        const instruction = response.solana_instruction;
        instruction.instruction_data = disc.dataHex;
        
        setTestResult({
          success: true,
          message: `Ready to test discriminator: ${disc.name}`,
          instruction: instruction,
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        error: error.message,
      });
    }
    
    setTesting(false);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Discriminator Tester</h1>
      <p className="text-muted-foreground mb-6">
        Test all possible Anchor discriminator formats to find which one matches your deployed program.
      </p>

      <div className="grid gap-4">
        {DISCRIMINATORS.map((disc) => (
          <Card key={disc.name}>
            <CardHeader>
              <CardTitle className="text-lg">{disc.name}</CardTitle>
              <CardDescription>
                Discriminator: <code className="bg-muted px-2 py-1 rounded">{disc.discriminator}</code>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Data (hex):</p>
                  <code className="text-xs bg-muted px-2 py-1 rounded block">{disc.dataHex}</code>
                </div>
                <Button
                  onClick={() => handleTest(disc)}
                  disabled={testing}
                  variant={selectedDisc?.name === disc.name ? 'default' : 'outline'}
                >
                  {testing && selectedDisc?.name === disc.name ? 'Testing...' : 'Test This'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {testResult && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Test Result</CardTitle>
          </CardHeader>
          <CardContent>
            {testResult.success ? (
              <div>
                <p className="text-green-500 mb-4">{testResult.message}</p>
                {testResult.instruction && (
                  <SolanaTransactionSigner
                    instruction={testResult.instruction}
                    onSuccess={(sig) => {
                      alert(`Success! Transaction: ${sig}`);
                    }}
                    onError={(err) => {
                      alert(`Failed: ${err.message}`);
                    }}
                  />
                )}
              </div>
            ) : (
              <p className="text-destructive">{testResult.error}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}