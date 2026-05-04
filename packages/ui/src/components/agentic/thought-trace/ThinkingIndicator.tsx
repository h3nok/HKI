/**
 * ThinkingAnimation — HKI Brand Thinking Spinner
 *
 * Refined red/blue motion system:
 * - HKI Blue orbital ring
 * - HKI Red satellite + core mark
 * - Subtle duotone halo for warmth and presence
 * - Clean enough for inline chat, distinct enough for agent work states
 */

import { motion } from "framer-motion";

const BLUE = "#0066B2";
const RED = "#E31837";
const SPINNER_C_GRADIENT = `linear-gradient(135deg, ${BLUE} 0%, ${BLUE} 42%, ${RED} 70%, ${RED} 100%)`;

// ============================================================================
// TYPES
// ============================================================================

export type ThinkingVariant = "minimal" | "standard" | "expanded";

export interface ThinkingAnimationProps {
  variant?: ThinkingVariant;
  label?: string;
  showLabel?: boolean;
  className?: string;
  animated?: boolean;
}

// ============================================================================
// SIZE CONFIG — tighter, cleaner proportions
// ============================================================================

const sizeConfig: Record<
  ThinkingVariant,
  {
    container: number;
    coreSize: number;
    orbitRadius: number;
    fontSize: number;
    strokeWidth: number;
    arcFraction: number;
    speed: number;
  }
> = {
  minimal: {
    container: 24,
    coreSize: 14,
    orbitRadius: 10,
    fontSize: 9,
    strokeWidth: 1.5,
    arcFraction: 0.3,
    speed: 1.2,
  },
  standard: {
    container: 48,
    coreSize: 26,
    orbitRadius: 20,
    fontSize: 15,
    strokeWidth: 2,
    arcFraction: 0.35,
    speed: 1.5,
  },
  expanded: {
    container: 80,
    coreSize: 42,
    orbitRadius: 34,
    fontSize: 24,
    strokeWidth: 2.5,
    arcFraction: 0.4,
    speed: 1.8,
  },
};

// ============================================================================
// ORBIT — single clean arc
// ============================================================================

function Orbit({
  radius,
  color,
  satelliteColor,
  strokeWidth,
  arcFraction,
  speed,
  container,
  animated,
}: {
  radius: number;
  color: string;
  satelliteColor: string;
  strokeWidth: number;
  arcFraction: number;
  speed: number;
  container: number;
  animated: boolean;
}) {
  const center = container / 2;
  const r = radius - strokeWidth / 2;
  const circumference = 2 * Math.PI * r;
  const dashLen = circumference * arcFraction;
  const gapLen = circumference - dashLen;
  const satelliteSize = Math.max(4, strokeWidth * 2.8);

  return (
    <>
      <motion.svg
        width={container}
        height={container}
        className="absolute inset-0"
        animate={{ rotate: animated ? 360 : 0 }}
        transition={
          animated
            ? { duration: speed, repeat: Infinity, ease: "linear" }
            : { duration: 0 }
        }
      >
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth * 0.45}
          opacity={0.12}
        />
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dashLen} ${gapLen}`}
          opacity={0.84}
        />
      </motion.svg>

      <motion.div
        className="absolute inset-0"
        animate={{ rotate: animated ? -360 : 0 }}
        transition={
          animated
            ? {
                duration: speed * 1.45,
                repeat: Infinity,
                ease: "linear",
              }
            : { duration: 0 }
        }
      >
        <span
          className="absolute rounded-full"
          style={{
            width: satelliteSize,
            height: satelliteSize,
            left: center - satelliteSize / 2,
            top: center - r - satelliteSize / 2,
            background: satelliteColor,
            boxShadow: animated
              ? `0 0 0 2px var(--card), 0 0 8px rgba(227, 24, 55, 0.16)`
              : `0 0 0 2px var(--card)`,
          }}
        />
      </motion.div>
    </>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ThinkingAnimation({
  variant = "standard",
  label = "Thinking",
  showLabel = true,
  className = "",
  animated = true,
}: ThinkingAnimationProps) {
  const c = sizeConfig[variant];

  return (
    <div
      className={`thinking-indicator flex flex-col items-center gap-2.5 ${className}`}
    >
      <div
        className="relative flex items-center justify-center"
        style={{ width: c.container, height: c.container }}
      >
        <motion.div
          className="absolute rounded-full"
          style={{
            width: c.coreSize + 10,
            height: c.coreSize + 10,
            background:
              "radial-gradient(circle at 28% 30%, rgba(0,102,178,0.12) 0%, rgba(0,102,178,0.06) 34%, rgba(227,24,55,0.05) 62%, transparent 78%)",
            filter: "blur(1px)",
          }}
          animate={
            animated
              ? { scale: [0.98, 1.02, 0.98], opacity: [0.82, 0.94, 0.82] }
              : { scale: 1, opacity: 0.72 }
          }
          transition={
            animated
              ? { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0 }
          }
        />

        <Orbit
          radius={c.orbitRadius}
          color={BLUE}
          satelliteColor={RED}
          strokeWidth={c.strokeWidth}
          arcFraction={c.arcFraction}
          speed={c.speed}
          container={c.container}
          animated={animated}
        />

        <motion.span
          className="absolute select-none"
          style={{
            fontSize: c.fontSize,
            fontWeight: 850,
            fontFamily: "var(--font-sans, 'Inter', system-ui, sans-serif)",
            lineHeight: 1,
            letterSpacing: "-0.02em",
            backgroundImage: SPINNER_C_GRADIENT,
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            color: RED,
            filter:
              !animated || variant === "minimal"
                ? "none"
                : "drop-shadow(0 6px 12px rgba(0, 102, 178, 0.08)) drop-shadow(0 6px 12px rgba(227, 24, 55, 0.08))",
          }}
          animate={
            animated
              ? { scale: [1, 1.04, 1], opacity: [0.94, 1, 0.94] }
              : { scale: 1, opacity: 1 }
          }
          transition={
            animated
              ? {
                  duration: 2.4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }
              : { duration: 0 }
          }
        >
          C
        </motion.span>
      </div>

      {/* Label */}
      {showLabel && variant !== "minimal" && (
        <motion.div
          className="flex items-center gap-1.5"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <span
            className="text-xs font-medium"
            style={{ color: "var(--muted-foreground)" }}
          >
            {label}
          </span>
          <span className="flex gap-0.5">
            {[BLUE, RED, BLUE].map((dotColor, i) => (
              <motion.span
                key={`${dotColor}-${i}`}
                className="rounded-full"
                style={{
                  width: 3,
                  height: 3,
                  background: dotColor,
                }}
                animate={
                  animated ? { opacity: [0.2, 1, 0.2] } : { opacity: 0.66 }
                }
                transition={
                  animated
                    ? {
                        duration: 1,
                        repeat: Infinity,
                        delay: i * 0.2,
                        ease: "easeInOut",
                      }
                    : { duration: 0 }
                }
              />
            ))}
          </span>
        </motion.div>
      )}
    </div>
  );
}

// ============================================================================
// INLINE THINKING — pill for chat messages
// ============================================================================

export function ThinkingInline({
  className = "",
  label,
}: {
  className?: string;
  label?: string;
}) {
  return (
    <motion.div
      className={`thinking-indicator inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${className}`}
      style={{
        background:
          "linear-gradient(135deg, rgba(0,102,178,0.08) 0%, rgba(227,24,55,0.04) 100%), var(--card)",
        border: "1px solid color-mix(in srgb, #0066B2 14%, var(--border))",
        boxShadow:
          "0 1px 4px rgba(0,0,0,0.04), 0 10px 18px -20px rgba(0,102,178,0.28)",
      }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
    >
      <ThinkingAnimation variant="minimal" showLabel={false} />
      {label ? (
        <motion.span
          key={label}
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--foreground)",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </motion.span>
      ) : (
        <span className="flex items-center gap-0.5">
          {[BLUE, RED, BLUE].map((dotColor, i) => (
            <motion.span
              key={`${dotColor}-${i}`}
              className="rounded-full"
              style={{
                width: 4,
                height: 4,
                background: dotColor,
              }}
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{
                duration: 1,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.2,
              }}
            />
          ))}
        </span>
      )}
    </motion.div>
  );
}

// ============================================================================
// THINKING CARD — prominent display
// ============================================================================

export function ThinkingCard({
  title = "Processing your request",
  description,
  className = "",
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <motion.div
      className={`thinking-indicator flex items-center gap-4 p-4 rounded-xl ${className}`}
      style={{
        background:
          "linear-gradient(180deg, rgba(0,102,178,0.04) 0%, rgba(227,24,55,0.03) 100%), var(--card)",
        border: "1px solid color-mix(in srgb, #0066B2 16%, var(--border))",
        boxShadow:
          "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px -4px rgba(0,0,0,0.06), 0 18px 32px -28px rgba(0,102,178,0.32)",
      }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
    >
      <ThinkingAnimation variant="standard" showLabel={false} />
      <div className="flex-1 min-w-0">
        <h4
          className="font-semibold text-sm"
          style={{ color: "var(--foreground)" }}
        >
          {title}
        </h4>
        {description && (
          <p
            className="text-xs mt-0.5"
            style={{ color: "var(--muted-foreground)" }}
          >
            {description}
          </p>
        )}
      </div>
    </motion.div>
  );
}
