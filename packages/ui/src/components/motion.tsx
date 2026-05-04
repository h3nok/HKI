"use client";

/**
 * Motion System — Brand-Aware Animation Wrappers
 *
 * Canonical motion components that consume the design system's
 * animation tokens. Use these instead of raw framer-motion to ensure
 * consistent, branded motion across the platform.
 *
 * @module @hki/ui/components/motion
 *
 * @example
 * ```tsx
 * import { FadeIn, StaggerList, SpringScale } from '@hki/ui';
 *
 * <FadeIn><Card>...</Card></FadeIn>
 *
 * <StaggerList>
 *   {items.map(item => <FadeIn key={item.id}><Card>{item}</Card></FadeIn>)}
 * </StaggerList>
 *
 * <SpringScale><Button>Click</Button></SpringScale>
 * ```
 */

import { motion, type HTMLMotionProps, AnimatePresence } from "framer-motion";
import * as React from "react";

import { cn } from "../utils";

// ═══════════════════════════════════════════════════════════════════════════════
// DESIGN SYSTEM MOTION TOKENS (from design-system.ts)
// ═══════════════════════════════════════════════════════════════════════════════

const EASE_SMOOTH: [number, number, number, number] = [0.16, 1, 0.3, 1];
const EASE_SPRING = { type: "spring" as const, stiffness: 400, damping: 25 };
const DURATION_FAST = 0.15;
const DURATION_NORMAL = 0.2;
const DURATION_SLOW = 0.3;

// ═══════════════════════════════════════════════════════════════════════════════
// FadeIn — Directional fade with smooth easing
// ═══════════════════════════════════════════════════════════════════════════════

type FadeDirection = "up" | "down" | "left" | "right" | "none";

export interface FadeInProps extends Omit<HTMLMotionProps<"div">, "initial" | "animate" | "exit"> {
  /** Direction to fade in from. Default: "up" */
  direction?: FadeDirection;
  /** Animation delay in seconds */
  delay?: number;
  /** Animation duration in seconds. Default: 0.3 */
  duration?: number;
  /** Distance to travel in px. Default: 20 */
  distance?: number;
  children: React.ReactNode;
}

const directionMap: Record<FadeDirection, (d: number) => { x?: number; y?: number }> = {
  up: (d) => ({ y: d }),
  down: (d) => ({ y: -d }),
  left: (d) => ({ x: d }),
  right: (d) => ({ x: -d }),
  none: () => ({}),
};

export const FadeIn = React.forwardRef<HTMLDivElement, FadeInProps>(
  (
    {
      direction = "up",
      delay = 0,
      duration = DURATION_SLOW,
      distance = 20,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const offset = directionMap[direction](distance);

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, ...offset }}
        animate={{
          opacity: 1,
          x: 0,
          y: 0,
          transition: {
            duration,
            delay,
            ease: EASE_SMOOTH,
          },
        }}
        className={className}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);
FadeIn.displayName = "FadeIn";

// ═══════════════════════════════════════════════════════════════════════════════
// StaggerList — Container that staggers child animations
// ═══════════════════════════════════════════════════════════════════════════════

export interface StaggerListProps extends Omit<HTMLMotionProps<"div">, "initial" | "animate"> {
  /** Delay between each child animation in seconds. Default: 0.08 */
  staggerDelay?: number;
  /** Whether children should animate in. Default: true */
  show?: boolean;
  children: React.ReactNode;
}

export const StaggerList = React.forwardRef<HTMLDivElement, StaggerListProps>(
  ({ staggerDelay = 0.08, show = true, className, children, ...props }, ref) => (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={show ? "visible" : "hidden"}
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: { staggerChildren: staggerDelay },
        },
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  )
);
StaggerList.displayName = "StaggerList";

// ═══════════════════════════════════════════════════════════════════════════════
// StaggerItem — Child item for use inside StaggerList
// ═══════════════════════════════════════════════════════════════════════════════

export interface StaggerItemProps extends Omit<HTMLMotionProps<"div">, "variants"> {
  children: React.ReactNode;
}

export const StaggerItem = React.forwardRef<HTMLDivElement, StaggerItemProps>(
  ({ className, children, ...props }, ref) => (
    <motion.div
      ref={ref}
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: {
          opacity: 1,
          y: 0,
          transition: {
            duration: DURATION_SLOW,
            ease: EASE_SMOOTH,
          },
        },
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  )
);
StaggerItem.displayName = "StaggerItem";

// ═══════════════════════════════════════════════════════════════════════════════
// SpringScale — Spring-physics interactive wrapper
// ═══════════════════════════════════════════════════════════════════════════════

export interface SpringScaleProps extends Omit<HTMLMotionProps<"div">, "whileTap" | "whileHover"> {
  /** Scale factor on hover. Default: 1.02 */
  hoverScale?: number;
  /** Scale factor on tap/press. Default: 0.98 */
  tapScale?: number;
  /** Disable all spring interaction */
  disabled?: boolean;
  children: React.ReactNode;
}

export const SpringScale = React.forwardRef<HTMLDivElement, SpringScaleProps>(
  (
    { hoverScale = 1.02, tapScale = 0.98, disabled = false, className, children, ...props },
    ref
  ) => (
    <motion.div
      ref={ref}
      whileHover={disabled ? {} : { scale: hoverScale }}
      whileTap={disabled ? {} : { scale: tapScale }}
      transition={EASE_SPRING}
      className={cn("will-change-transform", className)}
      {...props}
    >
      {children}
    </motion.div>
  )
);
SpringScale.displayName = "SpringScale";

// ═══════════════════════════════════════════════════════════════════════════════
// AnimateHeight — Smooth height transition for collapsible content
// ═══════════════════════════════════════════════════════════════════════════════

export interface AnimateHeightProps {
  /** Whether the content is visible */
  show: boolean;
  /** Duration in seconds. Default: 0.2 */
  duration?: number;
  children: React.ReactNode;
  className?: string;
}

export function AnimateHeight({
  show,
  duration = DURATION_NORMAL,
  children,
  className,
}: AnimateHeightProps) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{
            height: "auto",
            opacity: 1,
            transition: { duration, ease: EASE_SMOOTH },
          }}
          exit={{
            height: 0,
            opacity: 0,
            transition: { duration: DURATION_FAST, ease: "easeIn" },
          }}
          className={cn("overflow-hidden", className)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FadeInScale — Pop-in entrance (for modals, tooltips, notifications)
// ═══════════════════════════════════════════════════════════════════════════════

export interface FadeInScaleProps
  extends Omit<HTMLMotionProps<"div">, "initial" | "animate" | "exit"> {
  /** Animation delay in seconds */
  delay?: number;
  children: React.ReactNode;
}

export const FadeInScale = React.forwardRef<HTMLDivElement, FadeInScaleProps>(
  ({ delay = 0, className, children, ...props }, ref) => (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{
        opacity: 1,
        scale: 1,
        transition: {
          duration: DURATION_NORMAL,
          delay,
          ease: EASE_SMOOTH,
        },
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  )
);
FadeInScale.displayName = "FadeInScale";
