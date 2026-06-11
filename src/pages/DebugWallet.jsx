import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Wallet, Loader2, CheckCircle } from 'lucide-react';

export default function DebugWallet() {
  const [phantomConnected, setPhantomConnected] = useState(false);
  const [publicKey, setPublicKey] = useState(null);
  const [error, setError] = useState(null);

  const checkPhantom = async () => {
    setError(null);
    setPublicKey(null);
    
    if (!window.solana) {
      setError('Phantom not installed');
      return;
    }

    try {
      console.log('[Debug] Checking Phantom...');
      const response = await window.solana.connect();
      console.log('[Debug] Phantom response:', response);
      
      const pk = response.publicKey;
      console.log('[Debug] PublicKey object:', pk);
      console.log('[Debug] PublicKey type:', typeof pk);
      console.log('[Debug] PublicKey methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(pk)));
      
      let address;
      if (typeof pk?.toBase58 === 'function') {
        address = pk.toBase58();
        console.log('[Debug] Used toBase58():', address);
      } else if (typeof pk?.toString === 'function') {
        address = pk.toString();
        console.log('[Debug] Used toString():', address);
      } else {
        address = String(pk);
        console.log('[Debug] Used String():', address);
      }

      setPublicKey(address);
      setPhantomConnected(true);
      
      console.log('[Debug] Final address:', address);
      
    } catch (err) {
      console.error('[Debug] Phantom error:', err);
      setError(err.message);
    }
  };

  const handleDisconnect = async () => {
    if (window.solana) {
      try {
        await window.solana.disconnect();
        setPhantomConnected(false);
        setPublicKey(null);
        console.log('[Debug] Disconnected');
      } catch (err) {
        console.error('[Debug] Disconnect error:', err);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="font-heading font-bold text-3xl">Debug Wallet Connection</h1>
          <p className="text-muted-foreground">Check what wallet Phantom is actually returning</p>
        </div>

        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex gap-3">
              <Button onClick={checkPhantom} disabled={phantomConnected}>
                {phantomConnected ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Connected
                  </>
                ) : (
                  <>
                    <Wallet className="w-4 h-4 mr-2" />
                    Connect Phantom
                  </>
                )}
              </Button>

              {phantomConnected && (
                <Button variant="outline" onClick={handleDisconnect}>
                  Disconnect
                </Button>
              )}
            </div>

            {error && (
              <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
                <p className="text-destructive text-sm font-bold">Error:</p>
                <p className="text-muted-foreground text-sm mt-1">{error}</p>
              </div>
            )}

            {publicKey && (
              <div className="space-y-3">
                <div className="p-4 bg-accent/10 border border-accent/30 rounded-lg">
                  <p className="text-accent text-sm font-bold">✓ Connected Wallet:</p>
                  <p className="font-mono text-sm mt-2 break-all">{publicKey}</p>
                </div>

                <div className="p-4 bg-secondary/50 rounded-lg">
                  <p className="text-sm font-bold mb-2">Debug Info:</p>
                  <div className="text-xs font-mono space-y-1 text-muted-foreground">
                    <p>Length: {publicKey.length}</p>
                    <p>First 8: {publicKey.slice(0, 8)}</p>
                    <p>Last 8: {publicKey.slice(-8)}</p>
                  </div>
                </div>

                <div className="p-4 bg-primary/10 rounded-lg">
                  <p className="text-sm font-bold mb-2">Additional Debug Info:</p>
                  <div className="text-xs font-mono space-y-1 text-muted-foreground">
                    <p>Length: {publicKey.length}</p>
                    <p>First 8: {publicKey.slice(0, 8)}</p>
                    <p>Last 8: {publicKey.slice(-8)}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-secondary/30">
          <CardContent className="p-6">
            <h3 className="font-heading font-bold mb-3">Instructions:</h3>
            <ol className="text-sm space-y-2 list-decimal list-inside">
              <li>Click "Connect Phantom"</li>
              <li>Approve the connection in Phantom popup</li>
              <li>Check the wallet address displayed above</li>
              <li>Use this for debugging wallet connection issues</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}