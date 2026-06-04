import React from 'react';
import { motion } from 'framer-motion';

const WORLD_CUP_GROUPS_2026 = {
  A: [
    { name: 'Mexico', flag: '🇲🇽' },
    { name: 'South Africa', flag: '🇿🇦' },
    { name: 'South Korea', flag: '🇰🇷' },
    { name: 'Czechia', flag: '🇨🇿' },
  ],
  B: [
    { name: 'Canada', flag: '🇨🇦' },
    { name: 'Bosnia and Herzegovina', flag: '🇧🇦' },
    { name: 'Qatar', flag: '🇶🇦' },
    { name: 'Switzerland', flag: '🇨🇭' },
  ],
  C: [
    { name: 'Brazil', flag: '🇧🇷' },
    { name: 'Morocco', flag: '🇲🇦' },
    { name: 'Poland', flag: '🇵🇱' },
    { name: 'Saudi Arabia', flag: '🇸🇦' },
  ],
  D: [
    { name: 'USA', flag: '🇺🇸' },
    { name: 'Ecuador', flag: '🇪🇨' },
    { name: 'Denmark', flag: '🇩🇰' },
    { name: 'Cameroon', flag: '🇨🇲' },
  ],
  E: [
    { name: 'Germany', flag: '🇩🇪' },
    { name: 'Japan', flag: '🇯🇵' },
    { name: 'Nigeria', flag: '🇳🇬' },
    { name: 'Wales', flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿' },
  ],
  F: [
    { name: 'Argentina', flag: '🇦🇷' },
    { name: 'Sweden', flag: '🇸🇪' },
    { name: 'Iran', flag: '🇮🇷' },
    { name: 'Jamaica', flag: '🇯🇲' },
  ],
  G: [
    { name: 'Spain', flag: '🇪🇸' },
    { name: 'Australia', flag: '🇦🇺' },
    { name: 'Tunisia', flag: '🇹🇳' },
    { name: 'Panama', flag: '🇵🇦' },
  ],
  H: [
    { name: 'France', flag: '🇫🇷' },
    { name: 'Senegal', flag: '🇸🇳' },
    { name: 'Austria', flag: '🇦🇹' },
    { name: 'Costa Rica', flag: '🇨🇷' },
  ],
  I: [
    { name: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
    { name: 'Uruguay', flag: '🇺🇾' },
    { name: 'Ukraine', flag: '🇺🇦' },
    { name: 'Ghana', flag: '🇬🇭' },
  ],
  J: [
    { name: 'Portugal', flag: '🇵🇹' },
    { name: 'Croatia', flag: '🇭🇷' },
    { name: 'Chile', flag: '🇨🇱' },
    { name: 'Algeria', flag: '🇩🇿' },
  ],
  K: [
    { name: 'Netherlands', flag: '🇳🇱' },
    { name: 'Colombia', flag: '🇨🇴' },
    { name: 'Serbia', flag: '🇷🇸' },
    { name: 'Egypt', flag: '🇪🇬' },
  ],
  L: [
    { name: 'Italy', flag: '🇮🇹' },
    { name: 'Belgium', flag: '🇧🇪' },
    { name: 'Peru', flag: '🇵🇪' },
    { name: 'Paraguay', flag: '🇵🇾' },
  ],
};

export default function GroupNavigation({ onGroupClick, activeGroup }) {
  return (
    <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border/30 py-3 -mx-6 px-6 mb-6">
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
        <span className="text-xs font-bold text-muted-foreground mr-2 shrink-0">Groups:</span>
        
        {/* All Groups Button */}
        <motion.button
          key="ALL"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => onGroupClick('ALL')}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
            activeGroup === 'ALL'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-secondary/30 text-muted-foreground border-border/30 hover:border-primary/30 hover:text-foreground'
          }`}
        >
          All
        </motion.button>
        
        {Object.keys(WORLD_CUP_GROUPS_2026).map((groupName, index) => (
          <motion.button
            key={groupName}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            onClick={() => onGroupClick(groupName)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
              activeGroup === groupName
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-secondary/30 text-muted-foreground border-border/30 hover:border-primary/30 hover:text-foreground'
            }`}
          >
            {groupName}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

export { WORLD_CUP_GROUPS_2026 };