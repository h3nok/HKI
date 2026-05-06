'use client';

/**
 * DashboardSection — Reusable animated section for knowledge dashboard pages.
 *
 * Wraps children in a Framer Motion stagger container with per-child
 * pop-in animations. Use for any group of cards, stats, or content blocks.
 *
 * Usage:
 *   <DashboardSection title="Getting Started" icon={<Zap />} columns={3}>
 *     <SomeCard />
 *     <SomeCard />
 *   </DashboardSection>
 */

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@hki/ui';

// ── Animation presets (aligned with @hki/ui/dashboard) ────────────────────

const EASE = [0.22, 1, 0.36, 1] as const;

export const sectionStagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

export const cardPop = {
  hidden: { opacity: 0, y: 14, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.38, ease: EASE },
  },
};

export const fadeIn = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: EASE },
  },
};

// ── Component ────────────────────────────────────────────────────────────────

interface DashboardSectionProps {
  /** Section heading — omit for no header */
  title?: string;
  /** Icon rendered before the title */
  icon?: React.ReactNode;
  /** Trailing content (e.g. counter, filter) */
  trailing?: React.ReactNode;
  /** Grid columns for children — 0 means no grid (flex/custom layout) */
  columns?: 0 | 1 | 2 | 3 | 4 | 5;
  /** Extra className on the grid/children container */
  gridClassName?: string;
  /** Extra className on the outer section */
  className?: string;
  children: React.ReactNode;
}

const GRID_COLS: Record<number, string> = {
  0: '',
  1: 'grid grid-cols-1',
  2: 'grid grid-cols-1 md:grid-cols-2 gap-4',
  3: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4',
  4: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4',
  5: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4',
};

export function DashboardSection({
  title,
  icon,
  trailing,
  columns = 0,
  gridClassName,
  className,
  children,
}: DashboardSectionProps) {
  return (
    <motion.section
      variants={sectionStagger}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {title && (
        <motion.div variants={fadeIn} className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold flex items-center gap-2 text-foreground dark:text-foreground">
            {icon}
            {title}
          </h3>
          {trailing}
        </motion.div>
      )}
      <div className={cn(GRID_COLS[columns], gridClassName)}>
        {children}
      </div>
    </motion.section>
  );
}

/** Wrap any card-level child in this for pop-in animation within a DashboardSection */
export function AnimatedCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={cardPop} className={className}>
      {children}
    </motion.div>
  );
}
