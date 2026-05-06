/**
 * ActionButton — Reusable icon button for the input capsule
 *
 * Used for attachment, voice, and other action affordances.
 * Supports active state (e.g., recording) and badge count (e.g., file count).
 * Fully theme-aware via CSS custom properties.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@hki/ui';
import type { ActionButtonProps } from './prompt-input.types';

export function ActionButton({
  icon: Icon,
  size,
  iconSize,
  disabled = false,
  tooltip,
  ariaLabel,
  onClick,
  active = false,
  badge,
}: ActionButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={!disabled ? { scale: 1.08 } : undefined}
      whileTap={!disabled ? { scale: 0.92 } : undefined}
      className={cn(
        'relative shrink-0 flex items-center justify-center rounded-xl',
        'transition-all duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        disabled && 'opacity-40 cursor-not-allowed',
      )}
      style={{
        width: size,
        height: size,
        background: active
          ? 'color-mix(in srgb, var(--destructive) 14%, transparent)'
          : isHovered && !disabled
            ? 'color-mix(in srgb, var(--primary) 12%, transparent)'
            : 'transparent',
        color: active
          ? 'var(--destructive)'
          : isHovered && !disabled
            ? 'var(--primary)'
            : 'color-mix(in srgb, var(--foreground) 55%, transparent)',
      }}
      title={tooltip}
      aria-label={ariaLabel}
    >
      <Icon
        style={{ width: iconSize, height: iconSize }}
        className="stroke-[1.75] transition-colors duration-200"
      />

      {/* Badge (attachment count) */}
      {badge != null && badge > 0 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className={cn(
            'absolute -top-1 -right-1',
            'min-w-4.5 h-4.5 px-1',
            'flex items-center justify-center',
            'rounded-full text-[10px] font-bold leading-none',
            'bg-primary text-primary-foreground',
            'ring-2 ring-background',
          )}
        >
          {badge}
        </motion.span>
      )}
    </motion.button>
  );
}
