import React from 'react';
import { motion } from 'framer-motion';
import { Shield, CheckCircle, ArrowLeft, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export default function Terms() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/30">
        <div className="container mx-auto px-4 py-4">
          <Link to="/">
            <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-primary">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 border border-primary/20 mb-4">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h1 className="font-heading font-black text-3xl md:text-4xl mb-2">Terms of Service</h1>
            <p className="text-muted-foreground text-sm">Last updated: June 7, 2026</p>
          </div>

          <div className="prose prose-invert max-w-none">
            <section className="mb-8">
              <h2 className="font-heading font-bold text-2xl mb-4 text-primary">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                By accessing and using ElevenX (the "Platform"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by these terms, please do not use this Platform.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-heading font-bold text-2xl mb-4 text-primary">2. Description of Service</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                ElevenX is a decentralized peer-to-peer betting platform built on the Solana blockchain that allows users to:
              </p>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Place bets on sports events and tournament outcomes</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Provide liquidity to betting pools as a Liquidity Provider (LP)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Earn fees from matched bets</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Claim winnings and withdraw funds</span>
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="font-heading font-bold text-2xl mb-4 text-primary">3. Eligibility</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                You must be of legal gambling age in your jurisdiction to use this Platform. By using ElevenX, you represent and warrant that:
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                  <p className="text-muted-foreground text-sm">You are of legal age to participate in betting activities in your jurisdiction</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                  <p className="text-muted-foreground text-sm">You are not prohibited from using this Platform under applicable laws</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                  <p className="text-muted-foreground text-sm">You are using a valid Solana wallet that you control</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                  <p className="text-muted-foreground text-sm">You are not using the Platform for any illegal or fraudulent activities</p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="font-heading font-bold text-2xl mb-4 text-primary">4. Betting Rules</h2>
              <div className="bg-card/50 border border-border/50 rounded-xl p-6 mb-4">
                <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-accent" />
                  Important Betting Terms
                </h3>
                <ul className="space-y-2 text-muted-foreground text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>All bets are final and cannot be cancelled once confirmed on-chain</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Odds are determined by market activity and may change until matched</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Minimum bet amount is 0.01 SOL</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Betting windows close at the scheduled time for each event</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Settlement is based on official event results</span>
                  </li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="font-heading font-bold text-2xl mb-4 text-primary">5. Liquidity Provider Terms</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                By providing liquidity to betting pools, you acknowledge and agree that:
              </p>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>You will earn a share of fees (2-5%) from matched bets</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>You can withdraw unmatched liquidity at any time</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Matched liquidity is locked until market settlement</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>You bear the risk of market outcomes affecting your position</span>
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="font-heading font-bold text-2xl mb-4 text-primary">6. Fees and Payments</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-bold text-foreground mb-2">Platform Fees</h3>
                  <p className="text-muted-foreground text-sm">
                    ElevenX charges a 2% fee on all matched bets, which is distributed to Liquidity Providers. This fee is automatically deducted from winnings.
                  </p>
                </div>
                <div>
                  <h3 className="font-bold text-foreground mb-2">Network Fees</h3>
                  <p className="text-muted-foreground text-sm">
                    Solana network transaction fees apply to all on-chain transactions. These fees are paid to the Solana network, not to ElevenX.
                  </p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="font-heading font-bold text-2xl mb-4 text-primary">7. Risk Disclosure</h2>
              <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-6">
                <h3 className="font-bold text-destructive mb-3">⚠️ High Risk Warning</h3>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Betting involves significant financial risk. You should only participate if you understand the risks and can afford to lose your stake. Key risks include:
                </p>
                <ul className="space-y-2 text-muted-foreground text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-destructive">•</span>
                    <span>Loss of some or all of your invested funds</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-destructive">•</span>
                    <span>Smart contract vulnerabilities or exploits</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-destructive">•</span>
                    <span>Blockchain network issues or delays</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-destructive">•</span>
                    <span>Market volatility and odds fluctuations</span>
                  </li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="font-heading font-bold text-2xl mb-4 text-primary">8. Prohibited Activities</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                You agree not to:
              </p>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Use the Platform for money laundering or terrorist financing</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Attempt to manipulate betting markets or odds</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Use bots, scripts, or automated systems to gain unfair advantage</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Exploit bugs or vulnerabilities in the Platform</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Impersonate other users or misrepresent your identity</span>
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="font-heading font-bold text-2xl mb-4 text-primary">9. Disclaimer of Warranties</h2>
              <p className="text-muted-foreground leading-relaxed">
                THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-heading font-bold text-2xl mb-4 text-primary">10. Limitation of Liability</h2>
              <p className="text-muted-foreground leading-relaxed">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, ELEVENX SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE PLATFORM, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, OR BUSINESS INTERRUPTION.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-heading font-bold text-2xl mb-4 text-primary">11. Indemnification</h2>
              <p className="text-muted-foreground leading-relaxed">
                You agree to indemnify and hold harmless ElevenX, its operators, and contributors from any claims, damages, losses, or expenses arising from your use of the Platform or violation of these Terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-heading font-bold text-2xl mb-4 text-primary">12. Modifications to Service</h2>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to modify, suspend, or discontinue any part of the Platform at any time without notice. We are not liable for any changes, suspensions, or discontinuations of the Platform.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-heading font-bold text-2xl mb-4 text-primary">13. Governing Law</h2>
              <p className="text-muted-foreground leading-relaxed">
                These Terms shall be governed by and construed in accordance with the laws of the jurisdiction where ElevenX operates, without regard to conflict of law principles.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-heading font-bold text-2xl mb-4 text-primary">14. Contact Information</h2>
              <p className="text-muted-foreground leading-relaxed">
                For questions about these Terms of Service, please contact us at: legal@elevenx.bets
              </p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
}