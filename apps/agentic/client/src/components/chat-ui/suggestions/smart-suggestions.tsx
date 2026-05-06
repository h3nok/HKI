/**
 * SmartSuggestions - World-Class Suggestion Pills
 *
 * Premium Features:
 * - Proper CSS variable theming (light/dark)
 * - Complete interaction states
 * - Orchestrated stagger animations
 * - Accessibility-first with proper ARIA
 * - Strict 8px grid system
 */

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ChevronRight,
  Zap,
  Package,
  TrendingUp,
  Users,
  Truck,
} from "lucide-react";
import { cn } from "@hki/ui";

// ============================================================================
// TYPES
// ============================================================================

interface SmartSuggestionsProps {
  suggestions?: string[];
  onSelect: (suggestion: string) => void;
  className?: string;
}

// ============================================================================
// DESIGN TOKENS
// ============================================================================

const TOKENS = {
  animation: {
    staggerDelay: 0.05,
    itemDuration: 0.25,
    hoverDuration: 0.15,
  },
  ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
  spacing: {
    gap: 8, // 1 × 8px grid
    pillPadding: { x: 16, y: 10 }, // 2 × 8px, 1.25 × 8px
  },
} as const;

// ============================================================================
// DEFAULT DATA
// ============================================================================

// ============================================================================
// DEFAULT DATA
// ============================================================================

type SuggestionItem = {
  id: string;
  label: string;
  icon: any;
  subtext: string;
  accent: string;
};

const DEFAULT_SUGGESTIONS: SuggestionItem[] = [
  {
    id: "inventory",
    label: "Check Stock",
    icon: Package,
    subtext: "Global Inventory",
    accent: "var(--primary)",
  },
  {
    id: "sales",
    label: "Sales Report",
    icon: TrendingUp,
    subtext: "Daily Performance",
    accent: "color-mix(in srgb, var(--primary) 72%, var(--foreground))",
  },
  {
    id: "staff",
    label: "Staffing",
    icon: Users,
    subtext: "Shift Coverage",
    accent: "var(--primary)",
  },
  {
    id: "supply",
    label: "Replenish",
    icon: Truck,
    subtext: "Pending Orders",
    accent: "color-mix(in srgb, var(--primary) 72%, var(--foreground))",
  },
];

// ============================================================================
// ANIMATION VARIANTS
// ============================================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: TOKENS.animation.staggerDelay,
      delayChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.02,
      staggerDirection: -1,
    },
  },
};

const pillVariants = {
  hidden: {
    opacity: 0,
    y: 10,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: TOKENS.animation.itemDuration,
      ease: TOKENS.ease,
    },
  },
  exit: {
    opacity: 0,
    y: -4,
    scale: 0.98,
    transition: {
      duration: 0.15,
    },
  },
};

const headerVariants = {
  hidden: { opacity: 0, y: -8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: TOKENS.ease,
    },
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function SmartSuggestions({
  onSelect,
  className,
}: SmartSuggestionsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <motion.div
      className={cn("w-full overflow-hidden", className)}
      role="group"
      aria-label="Context Actions"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {/* Scrollable Container */}
      <div
        ref={scrollRef}
        className="flex items-center gap-3 overflow-x-auto pb-4 pt-1 px-1 scrollbar-hide snap-x"
        style={{
          maskImage:
            "linear-gradient(to right, transparent, black 10px, black 90%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent, black 10px, black 90%, transparent)",
        }}
      >
        {DEFAULT_SUGGESTIONS.map((item, index) => (
          <ContextTile
            key={item.id}
            item={item}
            index={index}
            onSelect={() => onSelect(item.label)}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface ContextTileProps {
  item: SuggestionItem;
  index: number;
  onSelect: () => void;
}

function ContextTile({ item, index, onSelect }: ContextTileProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.button
      type="button"
      variants={pillVariants}
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        "relative flex flex-col items-center justify-center shrink-0 snap-center",
        "rounded-2xl transition-all duration-200",
        "glass-chrome hover:bg-primary/8 hover:border-primary/30",
        "group"
      )}
      style={{
        width: 100,
        height: 100,
        boxShadow: isHovered
          ? "0 8px 20px -6px rgba(0,0,0,0.1), 0 0 0 1px color-mix(in srgb, var(--primary) 20%, transparent)"
          : "none",
      }}
    >
      {/* Icon Container */}
      <div
        className="flex items-center justify-center rounded-xl mb-2 transition-transform duration-300 group-hover:scale-110"
        style={{
          width: 44,
          height: 44,
          background: `color-mix(in srgb, ${item.accent} 10%, transparent)`,
          color: item.accent,
        }}
      >
        <item.icon className="w-6 h-6 stroke-[1.5]" />
      </div>

      {/* Label */}
      <span className="text-[13px] font-medium text-foreground tracking-tight leading-tight">
        {item.label}
      </span>

      {/* Subtext */}
      <span className="text-[10px] text-muted-foreground mt-0.5 opacity-80">
        {item.subtext}
      </span>

      {/* Shine effect on hover */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background:
            "linear-gradient(145deg, rgba(255,255,255,0.05) 0%, transparent 50%)",
        }}
      />
    </motion.button>
  );
}
