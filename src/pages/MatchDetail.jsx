import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useWallet } from '@/lib/WalletContext';
import { ArrowLeft, Clock, Trophy, TrendingUp, Users, Zap, CheckCircle2, Wallet, Award } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import SolanaTransactionSigner from '@/components/wallet/SolanaTransactionSigner';
import { calculateParimutuelOdds } from '@/utils/parimutuel';

const getFlagEmoji = (countryCode) => {
  if (!countryCode) return '🏳️';
  const codePoints = countryCode.toUpperCase().split('').map(char => 127397 + char.charCodeAt());
  return String.fromCodePoint(...codePoints);
};

function getParimutuelOdds(bet) {
  if (!bet) return { oddsA: null, oddsB: null, oddsDraw: null };
  const poolA = bet.pool_a || 0;
  const poolB = bet.pool_b || 0;
  const poolDraw = bet.pool_draw || 0;
  const totalPool = bet.total_pool || 0;
  const feePercent = bet.fee_percent || 200;
  return calculateParimutuelOdds(poolA, poolB, poolDraw, totalPool, feePercent);
}

const QUICK_AMOUNTS = [0.1, 0.25, 0.5, 1];

export default function MatchDetail() {
  const { matchId } = useParams();
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();

  const [selectedOutcome, setSelectedOutcome] = useState(null);
  const [amount, setAmount] = useState('');
  const [pendingTransaction, setPendingTransaction] = useState(null);
  const { isConnected, isConnecting, connect } = useWallet();

  const { data: match } = useQuery({
    queryKey: ['match', matchId],
    queryFn: () => base44.entities.Match.list().then(ms => ms.find(m => m.id === matchId)),
    enabled: !!matchId,
  });

  const { data: bets = [] } = useQuery({
    queryKey: ['betsForMatch', matchId],
    queryFn: () => base44.entities.Bet.filter({ match_id: matchId }),
    enabled: !!matchId,
    refetchInterval: 15000,
  });
  const bet = bets[0] || null;

  const getWalletAddress = () => {
    const walletSession = localStorage.getItem('elevenx_wallet_session');
    if (walletSession) {
      try {
        const parsed = JSON.parse(walletSession);
        return parsed.address || parsed;
      } catch { return walletSession; }
    }
    return null;
  };
  const walletAddress = getWalletAddress();

  const { data: myUserBets = [] } = useQuery({
    queryKey: ['myUserBets', matchId, walletAddress, user?.id],
    queryFn: () => base44.entities.UserBet.filter({ match_id: matchId }),
    enabled: !!matchId,
  });
  const myActiveBets = myUserBets.filter(ub =>
    (walletAddress && ub.wallet_address === walletAddress) ||
    (user?.id && ub.created_by_id === user.id)
  );

  const { data: allUserBets = [] } = useQuery({
    queryKey: ['allUserBetsForBet', bet?.id],
    queryFn: () => base44.entities.UserBet.filter({ bet_id: bet.id }),
    enabled: !!bet?.id,
  });

  const createMarketMutation = useMutation({
    mutationFn: async () => {
      const newBet = await base44.entities.Bet.create({
        match_id: matchId,
        outcome_a: match.team_a,
        outcome_b: match.team_b,
        outcome_draw: 'Draw',
        status: 'open',
        pool_a: 0, pool_b: 0, pool_draw: 0,
        total_pool: 0, total_bettors: 0, fee_percent: 200,
      });
      const response = await base44.functions.invoke('createMarketOnChain', {
        bet_id: newBet.id,
        match_id: matchId,
      });
      if (response.data.error) throw new Error(response.data.error);
      if (!response.data.solana_instruction && !response.data.alreadyExists) throw new Error('No instruction returned');
      return { response, betId: newBet.id };
    },
    onSuccess: (result) => {
      const responseData = result.response.data;
      if (responseData.solana_instruction) {
        setPendingTransaction({ instruction: responseData.solana_instruction, amount: 0, isMarketCreate: true });
      } else {
        queryClient.invalidateQueries({ queryKey: ['betsForMatch', matchId] });
      }
    },
    onError: (error) => alert('Failed to create market: ' + (error.message || 'Unknown error')),
  });

  const placeBetMutation = useMutation({
    mutationFn: async ({ outcome, stakeAmount }) => {
      const walletSession = localStorage.getItem('elevenx_wallet_session');
      let walletAddr = null;
      if (walletSession) {
        try { const p = JSON.parse(walletSession); walletAddr = p.address || p; }
        catch { walletAddr = walletSession; }
      }
      const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
      if (!walletAddr || !base58Regex.test(walletAddr)) {
        localStorage.removeItem('elevenx_wallet_session');
        throw new Error('Wallet address corrupted. Please reconnect your Phantom wallet.');
      }
      const response = await base44.functions.invoke('placeBet', {
        bet_id: bet.id,
        match_id: matchId,
        outcome,
        amount: stakeAmount,
        walletAddress: walletAddr,
      });
      if (response.data.error) throw new Error(response.data.error);
      if (!response.data.solana_instruction) throw new Error('No instruction returned');
      return { response, amount: stakeAmount, userBetId: response.data.userBetId };
    },
    onSuccess: (result) => {
      setPendingTransaction({
        instruction: result.response.data.solana_instruction,
        amount: result.amount,
        userBetId: result.userBetId,
      });
    },
    onError: (error) => alert('Failed to place bet: ' + (error.response?.data?.error || error.message)),
  });

  const claimMutation = useMutation({
    mutationFn: async (ubId) => {
      const response = await base44.functions.invoke('claimWinnings', { userBetId: ubId });
      if (response.data.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myUserBets', matchId, walletAddress, user?.id] });
    },
    onError: (error) => alert('Claim failed: ' + error.message),
  });

  const handleTransactionSuccess = async () => {
    queryClient.invalidateQueries({ queryKey: ['betsForMatch', matchId] });
    queryClient.invalidateQueries({ queryKey: ['myUserBets', matchId, walletAddress, user?.id] });
    queryClient.invalidateQueries({ queryKey: ['allUserBetsForBet', bet?.id] });
    setPendingTransaction(null);
    setSelectedOutcome(null);
    setAmount('');
  };

  const handleTransactionError = (err) => {
    console.error('Transaction failed:', err);
    if (pendingTransaction?.userBetId) {
      base44.entities.UserBet.update(pendingTransaction.userBetId, { status: 'refunded' });
    }
    setPendingTransaction(null);
  };

  function getOutcomeLabel(o) {
    if (!match || !bet) return o;
    if (o === 'a') return bet.outcome_a || match.team_a;
    if (o === 'b') return bet.outcome_b || match.team_b;
    return 'Draw';
  }

  if (!match) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const isAdmin = user?.role === 'admin';
  const hasBet = !!bet;
  const isOpen = bet?.status === 'open';
  const isSettled = bet?.status === 'settled';

  const poolA = bet ? (bet.pool_a || 0) : 0;
  const poolB = bet ? (bet.pool_b || 0) : 0;
  const poolDraw = bet ? (bet.pool_draw || 0) : 0;
  const totalPool = bet ? (bet.total_pool || 0) : 0;
  const { oddsA, oddsB, oddsDraw } = getParimutuelOdds(bet);

  const stakeNum = parseFloat(amount) || 0;
  const selectedOdds = selectedOutcome === 'a' ? oddsA : selectedOutcome === 'b' ? oddsB : oddsDraw;
  // Estimated payout: proportional share of total pool if they win (net pool after fee)
  const feeRate = (bet?.fee_percent || 200) / 10000;
  const estimatedPayout = selectedOdds ? stakeNum * selectedOdds : 0;

  const OUTCOMES = [
    { key: 'a',    label: bet?.outcome_a || match.team_a, flag: getFlagEmoji(match.team_a_flag), odds: oddsA,    pool: poolA,    color: 'primary' },
    { key: 'draw', label: 'Draw',                          flag: '🤝',                            odds: oddsDraw, pool: poolDraw, color: 'yellow'  },
    { key: 'b',    label: bet?.outcome_b || match.team_b,  flag: getFlagEmoji(match.team_b_flag), odds: oddsB,    pool: poolB,    color: 'accent'  },
  ];

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <Link to="/matches" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to matches
      </Link>

      {/* ── Match Header ── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border/50 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <span className="text-xs text-muted-foreground font-medium">{match.group_stage || 'World Cup 2026'}</span>
          <div className="flex items-center gap-2">
            {match.match_time && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {format(new Date(match.match_time), 'MMM d · h:mm a')}
              </span>
            )}
            <Badge className={`text-[10px] uppercase tracking-wider ${
              match.status === 'live' ? 'bg-destructive/20 text-destructive' :
              match.status === 'finished' ? 'bg-muted text-muted-foreground' :
              'bg-secondary text-secondary-foreground'
            }`}>
              {match.status === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse mr-1" />}
              {match.status}
            </Badge>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 text-center">
            <div className="w-20 h-20 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 flex items-center justify-center text-5xl shadow-lg">
              {getFlagEmoji(match.team_a_flag)}
            </div>
            <p className="font-heading font-black text-lg">{match.team_a}</p>
          </div>
          <div className="text-center">
            {match.status === 'finished' || match.status === 'live' ? (
              <div className="flex items-center gap-3">
                <span className="text-4xl font-heading font-bold">{match.score_a ?? 0}</span>
                <span className="text-muted-foreground text-xl">-</span>
                <span className="text-4xl font-heading font-bold">{match.score_b ?? 0}</span>
              </div>
            ) : (
              <span className="text-sm font-bold text-primary bg-primary/10 px-4 py-2 rounded-full">VS</span>
            )}
          </div>
          <div className="flex-1 text-center">
            <div className="w-20 h-20 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/30 flex items-center justify-center text-5xl shadow-lg">
              {getFlagEmoji(match.team_b_flag)}
            </div>
            <p className="font-heading font-black text-lg">{match.team_b}</p>
          </div>
        </div>
      </motion.div>

      {/* ── No market yet (admin only) ── */}
      {!hasBet && isAdmin && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-primary/20 rounded-2xl p-5 text-center">
          <Zap className="w-8 h-8 text-primary mx-auto mb-3" />
          <h3 className="font-heading font-bold mb-1">Open Betting Market</h3>
          <p className="text-xs text-muted-foreground mb-4">Create the pari-mutuel pool so users can start betting</p>
          {pendingTransaction ? (
            <SolanaTransactionSigner
              instruction={pendingTransaction.instruction}
              amount={0}
              onSuccess={handleTransactionSuccess}
              onError={handleTransactionError}
            />
          ) : (
            <Button
              onClick={() => createMarketMutation.mutate()}
              disabled={createMarketMutation.isPending}
              className="bg-primary hover:bg-primary/90 font-heading font-bold h-11 rounded-xl px-8"
            >
              {createMarketMutation.isPending ? (
                <>
                  <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
                  Opening...
                </>
              ) : 'Open Market'}
            </Button>
          )}
        </motion.div>
      )}

      {!hasBet && !isAdmin && (
        <div className="text-center py-10 bg-card border border-border/50 rounded-2xl">
          <p className="text-muted-foreground text-sm">Betting market not open yet. Check back soon!</p>
        </div>
      )}

      {/* ── Pool Odds ── */}
      {hasBet && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-card border border-border/50 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-bold text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Pool Odds
            </h3>
            <Badge className={`text-[10px] ${isOpen ? 'bg-accent/20 text-accent' : 'bg-secondary text-secondary-foreground'}`}>
              {bet.status}
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {OUTCOMES.map(o => (
              <div key={o.key} className={`rounded-xl p-3 text-center border ${
                o.color === 'primary' ? 'bg-primary/5 border-primary/20' :
                o.color === 'accent' ? 'bg-accent/5 border-accent/20' :
                'bg-yellow-500/5 border-yellow-500/20'
              }`}>
                <p className="text-xs text-muted-foreground mb-1 truncate">{o.label}</p>
                <p className={`font-heading font-black text-xl ${
                  o.color === 'primary' ? 'text-primary' : o.color === 'accent' ? 'text-accent' : 'text-yellow-400'
                }`}>
                  {o.odds !== null ? `${o.odds.toFixed(2)}x` : '—'}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">◎{o.pool.toFixed(2)} pooled</p>
              </div>
            ))}
          </div>

          <div className="text-xs text-center">
            {totalPool > 0 ? (
              <span className="font-bold text-foreground">◎{totalPool.toFixed(2)} total pool · {bet.total_bettors || 0} bettors</span>
            ) : (
              <span className="text-muted-foreground">No bets yet — be the first!</span>
            )}
          </div>
          <p className="text-[10px] text-center text-muted-foreground">Pari-mutuel: odds shift as the pool grows</p>
        </motion.div>
      )}

      {/* ── Place Bet Panel ── */}
      {hasBet && isOpen && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-card border border-primary/20 rounded-2xl p-5 space-y-4">
          <div>
            <h3 className="font-heading font-bold text-base mb-1">Place a Bet</h3>
            <p className="text-xs text-muted-foreground">Pick your outcome and stake SOL into the pool. Odds shift as more bets come in.</p>
          </div>

          {/* Outcome Selection */}
          <div className="grid grid-cols-3 gap-2">
            {OUTCOMES.map(o => (
              <button key={o.key}
                onClick={() => { setSelectedOutcome(o.key); setAmount(''); }}
                className={`rounded-xl p-3 border-2 text-center transition-all ${
                  selectedOutcome === o.key
                    ? o.color === 'primary' ? 'border-primary bg-primary/10' :
                      o.color === 'accent' ? 'border-accent bg-accent/10' :
                      'border-yellow-500 bg-yellow-500/10'
                    : 'border-border/50 bg-secondary/30 hover:border-border'
                }`}>
                <div className="text-2xl mb-1">{o.flag}</div>
                <p className="font-heading font-bold text-xs">{o.label}</p>
                <p className={`text-[10px] font-bold mt-0.5 ${
                  o.color === 'primary' ? 'text-primary' : o.color === 'accent' ? 'text-accent' : 'text-yellow-400'
                }`}>
                  {o.odds !== null ? `${o.odds.toFixed(2)}x` : '—'}
                </p>
              </button>
            ))}
          </div>

          {/* Amount + Summary */}
          <AnimatePresence>
            {selectedOutcome && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="space-y-4 overflow-hidden">
                <div>
                  <p className="text-xs font-medium text-foreground mb-2">How much do you want to stake?</p>
                  <Input type="number" placeholder="0.00" value={amount} min={0}
                    onChange={e => setAmount(e.target.value)}
                    className="bg-secondary/50 border-border/50 text-lg font-heading font-bold h-12" />
                  <div className="flex gap-2 flex-wrap mt-2">
                    {QUICK_AMOUNTS.map(qa => (
                      <button key={qa} onClick={() => setAmount(String(qa))}
                        className="px-3 py-1.5 text-xs font-medium bg-secondary hover:bg-secondary/80 rounded-lg transition-colors">◎{qa}</button>
                    ))}
                  </div>
                </div>

                {stakeNum > 0 && (
                  <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 space-y-2 text-xs">
                    <p className="font-bold text-foreground mb-2">Bet summary</p>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Backing</span>
                      <span className="font-bold">{getOutcomeLabel(selectedOutcome)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Stake</span>
                      <span className="font-bold">◎{stakeNum.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Current odds</span>
                      <span className="font-bold">{selectedOdds !== null ? `${selectedOdds.toFixed(2)}x` : '—'}</span>
                    </div>
                    <div className="h-px bg-border/30 my-1" />
                    <div className="flex justify-between font-bold text-sm">
                      <span>Est. payout if you win</span>
                      <span className="text-accent text-base">◎{estimatedPayout.toFixed(2)}</span>
                    </div>
                    <p className="text-muted-foreground text-[10px] pt-1">⚠ Odds may shift slightly by the time the market settles</p>
                  </div>
                )}

                {pendingTransaction && !pendingTransaction.isMarketCreate ? (
                  <SolanaTransactionSigner
                    instruction={pendingTransaction.instruction}
                    amount={pendingTransaction.amount}
                    userBetId={pendingTransaction.userBetId}
                    onSuccess={handleTransactionSuccess}
                    onError={handleTransactionError}
                  />
                ) : !isConnected ? (
                  <Button
                    onClick={async () => {
                      localStorage.removeItem('elevenx_wallet_session');
                      await connect();
                      setTimeout(() => refreshUser(), 1000);
                    }}
                    disabled={isConnecting}
                    className="w-full h-12 font-heading font-bold text-sm bg-accent hover:bg-accent/90 text-accent-foreground rounded-xl"
                  >
                    {isConnecting ? (
                      <><div className="w-5 h-5 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin mr-2" />Connecting...</>
                    ) : (
                      <><Wallet className="w-4 h-4 mr-2" />Connect Wallet to Bet</>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={() => placeBetMutation.mutate({ outcome: selectedOutcome, stakeAmount: stakeNum })}
                    disabled={stakeNum <= 0 || placeBetMutation.isPending}
                    className="w-full h-12 font-heading font-bold text-sm bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl"
                  >
                    {placeBetMutation.isPending ? (
                      <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    ) : (
                      `Bet ◎${stakeNum > 0 ? stakeNum.toFixed(2) : '0.00'} on ${getOutcomeLabel(selectedOutcome)}`
                    )}
                  </Button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ── Admin Settle Panel ── */}
      {hasBet && isAdmin && !isSettled && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-accent/20 rounded-2xl p-5 space-y-4">
          <div className="text-center">
            <Trophy className="w-8 h-8 text-accent mx-auto mb-2" />
            <h3 className="font-heading font-bold mb-1">Settle This Market</h3>
            <p className="text-xs text-muted-foreground mb-4">Select the winning outcome — pool will be distributed to all winners</p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {['a', 'b', 'draw'].map(outcome => (
                <Button key={outcome}
                  onClick={() => {
                    const label = outcome === 'draw' ? 'Draw' : outcome === 'a' ? bet.outcome_a : bet.outcome_b;
                    if (confirm(`Confirm ${label} won? This will distribute the pool to all winners.`)) {
                      base44.functions.invoke('announceWinner', { bet_id: bet.id, winning_outcome: outcome })
                        .then(res => {
                          if (res.data.success) {
                            alert(res.data.message);
                            queryClient.invalidateQueries({ queryKey: ['betsForMatch', matchId] });
                            queryClient.invalidateQueries({ queryKey: ['myUserBets', matchId, walletAddress, user?.id] });
                          } else alert('Error: ' + res.data.error);
                        })
                        .catch(err => alert('Failed to settle: ' + err.message));
                    }
                  }}
                  className={`h-10 font-heading font-bold text-xs rounded-xl ${
                    outcome === 'a' ? 'bg-primary hover:bg-primary/90 text-primary-foreground' :
                    outcome === 'b' ? 'bg-accent hover:bg-accent/90 text-accent-foreground' :
                    'bg-yellow-500 hover:bg-yellow-500/90 text-white'
                  }`}>
                  {outcome === 'a' ? bet.outcome_a : outcome === 'b' ? bet.outcome_b : 'Draw'}
                </Button>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Settled State ── */}
      {hasBet && isSettled && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-accent/20 rounded-2xl p-5 text-center">
          <CheckCircle2 className="w-8 h-8 text-accent mx-auto mb-2" />
          <h3 className="font-heading font-bold mb-1">Market Settled</h3>
          <p className="text-xs text-muted-foreground">
            Winner: <span className="font-bold text-accent">
              {bet.winning_outcome === 'a' ? bet.outcome_a : bet.winning_outcome === 'b' ? bet.outcome_b : 'Draw'}
            </span>
          </p>
          <p className="text-xs text-muted-foreground mt-2">Winners can claim their share below</p>
        </motion.div>
      )}

      {hasBet && !isOpen && !isSettled && (
        <div className="text-center py-8 bg-card border border-border/50 rounded-2xl">
          <p className="text-muted-foreground text-sm">Betting is closed for this market.</p>
        </div>
      )}

      {/* ── My Positions ── */}
      {myActiveBets.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-primary/20 rounded-2xl p-5 space-y-3">
          <h3 className="font-heading font-bold text-sm flex items-center gap-2">
            <Award className="w-4 h-4 text-primary" /> My Positions
          </h3>
          {myActiveBets.map(ub => (
            <div key={ub.id} className="bg-secondary/30 rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">{ub.outcome_label}</span>
                  <Badge className={`text-[9px] py-0 ${
                    ub.status === 'active' ? 'bg-accent/20 text-accent' :
                    ub.status === 'won' ? 'bg-accent/30 text-accent' :
                    ub.status === 'lost' ? 'bg-destructive/20 text-destructive' :
                    ub.status === 'claimed' ? 'bg-muted text-muted-foreground' :
                    'bg-secondary text-secondary-foreground'
                  }`}>{ub.status}</Badge>
                </div>
                <span className="font-bold">◎{ub.amount?.toFixed(2)}</span>
              </div>
              {ub.potential_payout > 0 && (
                <p className="text-xs text-muted-foreground">
                  Est. payout if you win: <span className="text-accent font-bold">◎{ub.potential_payout?.toFixed(2)}</span>
                </p>
              )}
              {ub.status === 'won' && (
                <Button onClick={() => claimMutation.mutate(ub.id)}
                  disabled={claimMutation.isPending}
                  size="sm"
                  className="w-full mt-2 h-8 text-xs bg-accent hover:bg-accent/90 text-accent-foreground font-bold rounded-lg">
                  {claimMutation.isPending ? 'Claiming...' : `Claim ◎${ub.actual_payout?.toFixed(2) || ub.potential_payout?.toFixed(2)}`}
                </Button>
              )}
            </div>
          ))}
        </motion.div>
      )}

      {/* ── Recent Bets ── */}
      {allUserBets.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          className="bg-card border border-border/50 rounded-2xl p-5">
          <h3 className="font-heading font-bold text-sm mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" /> Recent Bets
          </h3>
          <div className="space-y-2">
            {allUserBets.slice(0, 8).map(ub => (
              <div key={ub.id} className="flex items-center justify-between text-xs py-2 border-b border-border/20 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                  <span className="font-medium">{ub.outcome_label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold">◎{ub.amount?.toFixed(2)}</span>
                  {ub.potential_payout > 0 && <span className="text-accent font-medium">→ ◎{ub.potential_payout?.toFixed(2)}</span>}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}