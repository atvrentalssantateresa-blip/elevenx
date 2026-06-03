import React, { useState, useEffect } from 'react';
import { Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

export default function BetCountdown({ openUntil, onTimeExpired }) {
  const [timeLeft, setTimeLeft] = useState(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!openUntil) {
      setTimeLeft(null);
      return;
    }

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const endTime = new Date(openUntil).getTime();
      const difference = endTime - now;

      if (difference <= 0) {
        setTimeLeft(null);
        setIsExpired(true);
        onTimeExpired?.();
        return;
      }

      const minutes = Math.floor(difference / 60000);
      const seconds = Math.floor((difference % 60000) / 1000);
      setTimeLeft({ minutes, seconds });
      setIsExpired(false);
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [openUntil, onTimeExpired]);

  if (isExpired) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 text-center"
      >
        <div className="flex items-center justify-center gap-2 text-destructive">
          <AlertCircle className="w-4 h-4" />
          <span className="font-heading font-bold text-sm">BETS CLOSED</span>
        </div>
        <p className="text-xs text-destructive/80 mt-1">Betting window has closed</p>
      </motion.div>
    );
  }

  if (!timeLeft) {
    return null;
  }

  const isUrgent = timeLeft.minutes < 5 || (timeLeft.minutes === 5 && timeLeft.seconds < 30);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl p-3 text-center ${
        isUrgent 
          ? 'bg-destructive/10 border border-destructive/30' 
          : 'bg-accent/10 border border-accent/30'
      }`}
    >
      <div className={`flex items-center justify-center gap-2 ${
        isUrgent ? 'text-destructive' : 'text-accent'
      }`}>
        <Clock className="w-4 h-4" />
        <span className="font-heading font-bold text-lg">
          {String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
        </span>
      </div>
      <p className={`text-xs mt-1 ${
        isUrgent ? 'text-destructive/80' : 'text-accent/80'
      }`}>
        {isUrgent ? 'Hurry! Betting closes soon' : 'Time remaining'}
      </p>
    </motion.div>
  );
}