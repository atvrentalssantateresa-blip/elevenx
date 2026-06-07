import React from 'react';
import { motion } from 'framer-motion';
import { Shield, CheckCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export default function Privacy() {
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
            <h1 className="font-heading font-black text-3xl md:text-4xl mb-2">Privacy Policy</h1>
            <p className="text-muted-foreground text-sm">Last updated: June 7, 2026</p>
          </div>

          <div className="prose prose-invert max-w-none">
            <section className="mb-8">
              <h2 className="font-heading font-bold text-2xl mb-4 text-primary">1. Introduction</h2>
              <p className="text-muted-foreground leading-relaxed">
                Welcome to ElevenX ("we", "our", or "us"). We are committed to protecting your privacy and ensuring you have a positive experience when using our decentralized betting platform. This Privacy Policy explains what information we collect, how we use it, and your rights regarding your information.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-heading font-bold text-2xl mb-4 text-primary">2. Information We Collect</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-bold text-foreground mb-1">Wallet Information</h3>
                    <p className="text-muted-foreground text-sm">We only access your Solana wallet address when you connect to use our platform. We do not store private keys or sensitive wallet credentials.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-bold text-foreground mb-1">Transaction Data</h3>
                    <p className="text-muted-foreground text-sm">We record on-chain transaction data (bets, claims, withdrawals) to provide you with accurate account information and betting history.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-bold text-foreground mb-1">Usage Information</h3>
                    <p className="text-muted-foreground text-sm">We may collect anonymized usage data to improve our platform performance and user experience.</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="font-heading font-bold text-2xl mb-4 text-primary">3. How We Use Your Information</h2>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>To facilitate betting transactions on the Solana blockchain</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>To display your betting history and account balances</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>To process withdrawals and distribute winnings</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>To improve platform functionality and user experience</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>To comply with applicable laws and regulations</span>
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="font-heading font-bold text-2xl mb-4 text-primary">4. Data Storage and Security</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Your data is stored using Base44's secure infrastructure and on the Solana blockchain. We implement industry-standard security measures to protect your information:
              </p>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Encrypted data transmission</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Secure smart contract architecture</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Regular security audits</span>
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="font-heading font-bold text-2xl mb-4 text-primary">5. Third-Party Services</h2>
              <p className="text-muted-foreground leading-relaxed">
                We use The Odds API to fetch live sports odds. This third-party service may have its own privacy policies governing data collection. We recommend reviewing their privacy policy for more information.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-heading font-bold text-2xl mb-4 text-primary">6. Your Rights</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                You have the following rights regarding your data:
              </p>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Access to your betting history and transaction data</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Ability to withdraw your funds at any time</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Disconnect your wallet from our platform</span>
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="font-heading font-bold text-2xl mb-4 text-primary">7. Age Restrictions</h2>
              <p className="text-muted-foreground leading-relaxed">
                Our platform is only available to users who are of legal gambling age in their jurisdiction. By using ElevenX, you confirm that you meet the minimum age requirement in your location.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-heading font-bold text-2xl mb-4 text-primary">8. Changes to This Policy</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-heading font-bold text-2xl mb-4 text-primary">9. Contact Us</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about this Privacy Policy, please contact us at: privacy@elevenx.bets
              </p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
}