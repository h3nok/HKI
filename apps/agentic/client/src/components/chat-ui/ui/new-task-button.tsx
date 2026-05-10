/**
 * NewTaskButton — Hermetic Platform
 *
 * Brand-native design using HKI's visual identity:
 * - HKI Iris accent line — the HKI action color
 * - Blue (#005DAA) icon tint — trust & intelligence
 * - Warm neutrals, compact, warehouse-efficient layout
 * - No fluff — direct, value-focused (like HKI itself)
 */

import { forwardRef } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { Plus } from 'lucide-react';

export interface NewTaskButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: 'sidebar' | 'header';
  'aria-label'?: string;
  shortcut?: string;
  activeProject?: { name: string; emoji: string; color?: string } | null;
}

export const NewTaskButton = forwardRef<HTMLButtonElement, NewTaskButtonProps>(
  ({ onClick, variant = 'sidebar', className, shortcut, activeProject, 'aria-label': ariaLabel, ...props }, ref) => {

    const label = activeProject
      ? `New task in ${activeProject.name}`
      : 'New task';

    // VARIANT: HEADER (Compact pill)
    if (variant === 'header') {
      return (
        <motion.button
          ref={ref}
          type="button"
          onClick={onClick}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${className || ''}`}
          style={{
            background: 'var(--primary)',
            color: 'var(--primary-foreground)',
          }}
          aria-label={ariaLabel || label}
          title={label}
          {...props}
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
          <span>New task</span>
        </motion.button>
      );
    }

    // VARIANT: SIDEBAR — HKI branded
    return (
      <motion.button
        ref={ref}
        type="button"
        onClick={onClick}
        whileTap={{ scale: 0.98 }}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold
                    transition-all duration-150 cursor-pointer
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
                    ${className || ''}`}
        style={{
          background: 'var(--primary)',
          color: 'var(--primary-foreground)',
        }}
        aria-label={ariaLabel || label}
        title={label}
        {...props}
      >
        <Plus className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} />
        <span className="flex-1 text-left truncate">
          {activeProject ? (
            <>New task <span className="opacity-70 font-normal">in {activeProject.name}</span></>
          ) : (
            'New task'
          )}
        </span>
        {shortcut && (
          <kbd className="shrink-0 text-[9px] opacity-50 font-mono px-1 py-0.5 rounded border border-white/20">
            {shortcut}
          </kbd>
        )}
      </motion.button>
    );
  }
);

NewTaskButton.displayName = 'NewTaskButton';
