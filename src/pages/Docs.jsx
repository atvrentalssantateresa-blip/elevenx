import React from 'react';
import { motion } from 'framer-motion';
import { 
  Trophy, 
  Zap, 
  Shield, 
  Globe, 
  TrendingUp, 
  Wallet, 
  CheckCircle, 
  ArrowRight,
  BookOpen,
  Sparkles,
  Lock,
  RefreshCcw,
  Users,
  Award,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';

export default function Docs() {
  const features = [
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: "Dynamic Odds",
      description: "Real-time odds that adjust based on market activity and liquidity, ensuring fair pricing for all participants.",
      color: "text-primary"
    },
    {
      icon: <Wallet className="w-6 h-6" />,
      title: "Liquidity Provider Rewards",
      description: "Earn fees by providing liquidity to betting pools. LPs receive a share of every matched bet.",
      color: "text-accent"
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Fully Decentralized",
      description: "Built on Solana blockchain for transparent, trustless betting. No intermediaries, no manipulation.",
      color: "text-primary"
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Instant Settlements",
      description: "Automated on-chain settlement means winners get paid immediately after events conclude.",
      color: "text-accent"
    },
    {
      icon: <Globe className="w-6 h-6" />,
      title: "Global Access",
      description: "No geographic restrictions. Anyone with a Solana wallet can participate.",
      color: "text-primary"
    },
    {
      icon: <Lock className="w-6 h-6" />,
      title: "Non-Custodial",
      description: "You maintain full control of your funds. Smart contracts handle all transactions automatically.",
      color: "text-accent"
    }
  ];

  const howItWorks = [
    {
      step: "01",
      title: "Connect Wallet",
      description: "Link your Phantom wallet to get started. No KYC, no signups required.",
      icon: <Wallet className="w-8 h-8" />
    },
    {
      step: "02",
      title: "Choose Your Bet",
      description: "Browse live matches and futures markets. Select your outcome and stake amount.",
      icon: <Trophy className="w-8 h-8" />
    },
    {
      step: "03",
      title: "Sign Transaction",
      description: "Confirm your bet with a single Solana transaction. Funds are locked in the pool.",
      icon: <CheckCircle className="w-8 h-8" />
    },
    {
      step: "04",
      title: "Win & Claim",
      description: "If your outcome wins, claim your payout instantly after settlement.",
      icon: <Award className="w-8 h-8" />
    }
  ];

  const stats = [
    { value: "0.01 SOL", label: "Minimum Bet", icon: <TrendingUp className="w-5 h-5" /> },
    { value: "Instant", label: "Payouts", icon: <Zap className="w-5 h-5" /> },
    { value: "100%", label: "Transparent", icon: <Shield className="w-5 h-5" /> },
    { value: "24/7", label: "Global Markets", icon: <Globe className="w-5 h-5" /> }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:32px]" />
        <div className="container mx-auto px-4 py-20 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-4xl mx-auto"
          >
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20 text-xs px-4 py-1.5">
              <Sparkles className="w-3 h-3 mr-1" />
              Welcome to ElevenX
            </Badge>
            <h1 className="font-heading font-black text-5xl md:text-6xl lg:text-7xl mb-6 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              The Future of Decentralized Betting
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Experience the next generation of peer-to-peer betting powered by Solana. 
              Transparent odds, instant payouts, and rewards for liquidity providers.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Button asChild className="h-12 px-8 rounded-xl font-bold text-base">
                <Link to="/matches">
                  Start Betting
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-12 px-8 rounded-xl font-bold text-base">
                <Link to="/lp">
                  Become an LP
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-y border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex flex-col items-center text-center"
              >
                <div className="text-primary mb-2">{stat.icon}</div>
                <div className="font-heading font-black text-2xl mb-1">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why ElevenX Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-heading font-black text-4xl md:text-5xl mb-4">
              Why ElevenX is <span className="text-primary">Brilliant</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              We've reimagined betting from the ground up, leveraging blockchain technology 
              to create a fair, transparent, and rewarding experience for everyone.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group p-6 rounded-2xl border border-border/50 bg-card/50 hover:border-primary/30 transition-all duration-300"
              >
                <div className={`mb-4 ${feature.color}`}>{feature.icon}</div>
                <h3 className="font-heading font-bold text-xl mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-gradient-to-b from-background via-primary/5 to-background">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-heading font-black text-4xl md:text-5xl mb-4">
              How It Works
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Get started in minutes. No complicated signups, no waiting for approvals.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {howItWorks.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative"
              >
                {i < howItWorks.length - 1 && (
                  <div className="hidden lg:block absolute top-12 left-full w-full h-0.5 bg-gradient-to-r from-primary/30 to-transparent -translate-x-8" />
                )}
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-accent/10 border-2 border-primary/30 mb-6">
                    <div className="text-primary">{step.icon}</div>
                  </div>
                  <div className="text-[10px] font-bold text-primary mb-2">STEP {step.step}</div>
                  <h3 className="font-heading font-bold text-lg mb-2">{step.title}</h3>
                  <p className="text-muted-foreground text-sm">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Betting Markets Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-heading font-black text-4xl md:text-5xl mb-4">
              Betting Markets
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Choose from live match betting or long-term futures on tournament outcomes.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Match Betting */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="p-8 rounded-3xl border border-border/50 bg-card/50 hover:border-primary/30 transition-all"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-heading font-bold text-2xl">Match Betting</h3>
              </div>
              <p className="text-muted-foreground mb-6">
                Bet on individual match outcomes with dynamic odds that reflect real-time market activity. 
                Choose from home win, away win, or draw.
              </p>
              <ul className="space-y-3 mb-6">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-accent mt-0.5" />
                  <span className="text-sm">Live odds from The Odds API</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-accent mt-0.5" />
                  <span className="text-sm">Parimutuel pool betting</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-accent mt-0.5" />
                  <span className="text-sm">Instant settlement after match ends</span>
                </li>
              </ul>
              <Button asChild className="w-full rounded-xl font-bold">
                <Link to="/matches">
                  Browse Matches
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </motion.div>

            {/* Futures Betting */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="p-8 rounded-3xl border border-border/50 bg-card/50 hover:border-accent/30 transition-all"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center">
                  <Award className="w-6 h-6 text-accent" />
                </div>
                <h3 className="font-heading font-bold text-2xl">Futures Markets</h3>
              </div>
              <p className="text-muted-foreground mb-6">
                Long-term bets on tournament outcomes. Predict which team will finish 1st, 2nd, or 3rd 
                in the World Cup or other major tournaments.
              </p>
              <ul className="space-y-3 mb-6">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-accent mt-0.5" />
                  <span className="text-sm">High multiplier odds (2x-50x+)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-accent mt-0.5" />
                  <span className="text-sm">LP-backed liquidity pools</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-accent mt-0.5" />
                  <span className="text-sm">Settled after tournament concludes</span>
                </li>
              </ul>
              <Button asChild variant="outline" className="w-full rounded-xl font-bold">
                <Link to="/futures">
                  View Futures
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* LP Section */}
      <section className="py-20 bg-gradient-to-r from-accent/5 via-background to-accent/5">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <Badge className="mb-4 bg-accent/10 text-accent border-accent/20">
              <Users className="w-3 h-3 mr-1" />
              Liquidity Providers
            </Badge>
            <h2 className="font-heading font-black text-4xl md:text-5xl mb-4">
              Earn Passive Income as an LP
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Provide liquidity to betting pools and earn a share of fees on every matched bet. 
              Your SOL works for you.
            </p>
          </motion.div>

          <div className="max-w-4xl mx-auto bg-card/50 border border-border/50 rounded-3xl p-8 md:p-12">
            <div className="grid md:grid-cols-3 gap-8 mb-8">
              <div className="text-center">
                <div className="text-3xl font-black text-accent mb-2">2-5%</div>
                <div className="text-sm text-muted-foreground">Fee Share per Bet</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-black text-accent mb-2">Flexible</div>
                <div className="text-sm text-muted-foreground">Withdraw Anytime</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-black text-accent mb-2">Auto-Compounding</div>
                <div className="text-sm text-muted-foreground">Maximize Returns</div>
              </div>
            </div>
            <Button asChild className="w-full h-14 rounded-xl font-bold text-lg bg-accent hover:bg-accent/90">
              <Link to="/lp">
                Start Providing Liquidity
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Technology Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-heading font-black text-4xl md:text-5xl mb-4">
              Built on Solana
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Leveraging the speed and security of Solana blockchain for instant, 
              trustless transactions.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {[
              { label: "Transaction Speed", value: "~400ms", icon: <Zap className="w-5 h-5" /> },
              { label: "Transaction Cost", value: "<$0.01", icon: <TrendingUp className="w-5 h-5" /> },
              { label: "Network Uptime", value: "99.9%", icon: <RefreshCcw className="w-5 h-5" /> },
              { label: "Security", value: "Audited", icon: <Shield className="w-5 h-5" /> }
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-6 rounded-2xl border border-border/50 bg-card/50 text-center"
              >
                <div className="text-primary mb-3 flex justify-center">{item.icon}</div>
                <div className="font-heading font-black text-2xl mb-1">{item.value}</div>
                <div className="text-xs text-muted-foreground">{item.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-b from-background via-primary/5 to-background">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-3xl mx-auto"
          >
            <h2 className="font-heading font-black text-4xl md:text-5xl mb-6">
              Ready to Start?
            </h2>
            <p className="text-muted-foreground text-lg mb-8">
              Join the decentralized betting revolution. Connect your wallet and experience 
              the future of peer-to-peer betting today.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Button asChild className="h-14 px-8 rounded-xl font-bold text-lg">
                <Link to="/matches">
                  Start Betting Now
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-14 px-8 rounded-xl font-bold text-lg">
                <Link to="/futures">
                  Explore Futures
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-12 bg-card/30">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="font-heading font-black text-xl">ElevenX</div>
                <div className="text-xs text-muted-foreground">Decentralized Betting Protocol</div>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span>Built on Solana</span>
              <span>•</span>
              <span>Powered by Community</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}