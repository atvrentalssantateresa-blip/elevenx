import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { Share2, Copy, Check, Image, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function ShareBetModal({ open, onClose, bet, match, futuresMarket }) {
  const shareCardRef = useRef(null);
  const [copiedImage, setCopiedImage] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  const isFutures = !!futuresMarket || !!bet._isFutures;
  const teamName = isFutures ? (bet.outcome_label || 'Your Choice') : (bet.outcome === 'a' ? match?.team_a : bet.outcome === 'b' ? match?.team_b : 'Draw');
  const teamFlag = isFutures ? '🏆' : (bet.outcome === 'a' ? match?.team_a_flag : bet.outcome === 'b' ? match?.team_b_flag : '🤝');
  
  const matchUrl = isFutures 
    ? `${window.location.origin}/futures`
    : `${window.location.origin}/match/${bet.match_id}`;

  const shareText = `Come match my bet of ◎${(bet.totalAmount || bet.amount || 0).toFixed(2)} SOL on ${teamFlag} ${teamName}! 🚀⚽️\n\nBet link: ${matchUrl}`;

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch (err) {
      console.error('Failed to copy text', err);
    }
  };

  const handleCopyImageAndText = async () => {
    if (!shareCardRef.current) return;
    try {
      const canvas = await html2canvas(shareCardRef.current, {
        backgroundColor: '#0c0c0c',
        scale: 2,
        useCORS: true,
      });

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              'image/png': blob,
            }),
          ]);
          setCopiedImage(true);
          await navigator.clipboard.writeText(shareText);
          setTimeout(() => setCopiedImage(false), 2500);
        } catch (err) {
          console.error('Failed to copy image blob', err);
          const link = document.createElement('a');
          link.download = `ElevenX-Bet-${bet.id}.png`;
          link.href = canvas.toDataURL();
          link.click();
        }
      }, 'image/png');
    } catch (error) {
      console.error('Error generating card image', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#0c0c0c] border border-primary/20 max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading font-black text-lg flex items-center gap-2 text-primary">
            <Sparkles className="w-5 h-5 text-primary animate-pulse" />
            Share Your Bet
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="p-2 bg-gradient-to-b from-primary/10 to-transparent rounded-2xl border border-primary/10">
            <div 
              ref={shareCardRef}
              className="bg-[#111111] border-2 border-primary/30 rounded-xl p-5 text-center space-y-4 shadow-xl"
              style={{ width: '100%', maxWidth: '320px', margin: '0 auto' }}
            >
              <div className="flex items-center justify-between border-b border-primary/10 pb-2">
                <span className="font-heading font-black text-xs tracking-wider text-primary">ELEVEN<span className="text-white">X</span></span>
                <span className="text-[9px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold">SOLANA P2P</span>
              </div>

              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold truncate">
                {bet.match_title || 'World Cup Match'}
              </p>

              <div className="py-2 bg-secondary/20 rounded-lg">
                <div className="text-4xl mb-2">{teamFlag}</div>
                <p className="text-xs text-muted-foreground">BACKED OUTCOME</p>
                <p className="font-heading font-black text-lg text-primary">{teamName}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-primary/10">
                <div className="text-center">
                  <p className="text-[9px] text-muted-foreground">My Stake</p>
                  <p className="font-heading font-bold text-sm text-white">◎{(bet.totalAmount || bet.amount || 0).toFixed(2)} SOL</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] text-muted-foreground">Potential Payout</p>
                  <p className="font-heading font-bold text-sm text-accent">◎{(bet.totalPayout || bet.potential_payout || 0).toFixed(2)} SOL</p>
                </div>
              </div>

              <p className="text-[8px] text-primary/60 font-semibold italic">
                Scan QR or click link to match my bet! 🎯
              </p>
            </div>
          </div>

          <div className="bg-secondary/30 rounded-xl p-3 border border-border/50">
            <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Pre-filled Message</p>
            <p className="text-xs text-foreground line-clamp-3 font-medium bg-[#141414] p-2 rounded border border-border/30">
              {shareText}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleCopyText}
              className="h-10 text-xs font-bold rounded-xl border-border/50 hover:bg-secondary/40"
            >
              {copiedText ? (
                <><Check className="w-3.5 h-3.5 mr-1.5 text-accent" /> Copied Text!</>
              ) : (
                <><Copy className="w-3.5 h-3.5 mr-1.5" /> Copy Text</>
              )}
            </Button>
            
            <Button
              onClick={handleCopyImageAndText}
              className="h-10 text-xs font-heading font-black rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {copiedImage ? (
                <><Check className="w-3.5 h-3.5 mr-1.5" /> Image Copied!</>
              ) : (
                <><Image className="w-3.5 h-3.5 mr-1.5" /> Copy Image & Link</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}