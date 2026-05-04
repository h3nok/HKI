import { useId } from "react";
import { motion } from "framer-motion";

const BLUE = "#0066B2";
const RED = "#E31837";

export type ThinkingVariant = "minimal" | "standard" | "expanded";

export interface ThinkingAnimationProps {
  variant?: ThinkingVariant;
  label?: string;
  showLabel?: boolean;
  className?: string;
  animated?: boolean;
}

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
    arcFraction: 0.34,
    speed: 1.2,
  },
  standard: {
    container: 48,
    coreSize: 26,
    orbitRadius: 20,
    fontSize: 15,
    strokeWidth: 2,
    arcFraction: 0.38,
    speed: 1.45,
  },
  expanded: {
    container: 80,
    coreSize: 42,
    orbitRadius: 34,
    fontSize: 24,
    strokeWidth: 2.5,
    arcFraction: 0.42,
    speed: 1.75,
  },
};

function Orbit({
  radius,
  strokeWidth,
  arcFraction,
  speed,
  container,
  animated,
  gradientId,
}: {
  radius: number;
  strokeWidth: number;
  arcFraction: number;
  speed: number;
  container: number;
  animated: boolean;
  gradientId: string;
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
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={BLUE} />
            <stop offset="56%" stopColor={BLUE} />
            <stop offset="100%" stopColor={RED} />
          </linearGradient>
        </defs>
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke={BLUE}
          strokeWidth={strokeWidth * 0.45}
          opacity={0.14}
        />
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dashLen} ${gapLen}`}
          opacity={0.98}
        />
      </motion.svg>

      <motion.div
        className="absolute inset-0"
        animate={{ rotate: animated ? -360 : 0 }}
        transition={
          animated
            ? { duration: speed * 1.4, repeat: Infinity, ease: "linear" }
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
            background: RED,
            boxShadow: animated
              ? "0 0 0 2px var(--card), 0 0 10px rgba(227, 24, 55, 0.22)"
              : "0 0 0 2px var(--card)",
          }}
        />
      </motion.div>
    </>
  );
}

function SplitBrandC({
  fontSize,
  animated,
}: {
  fontSize: number;
  animated: boolean;
}) {
  return (
    <motion.span
      className="absolute select-none"
      style={{
        fontSize,
        fontWeight: 850,
        fontFamily: "var(--font-sans, 'Inter', system-ui, sans-serif)",
        lineHeight: 1,
        letterSpacing: "-0.02em",
        display: "inline-block",
      }}
      animate={
        animated
          ? { scale: [1, 1.04, 1], opacity: [0.94, 1, 0.94] }
          : { scale: 1, opacity: 1 }
      }
      transition={
        animated
          ? { duration: 2.3, repeat: Infinity, ease: "easeInOut" }
          : { duration: 0 }
      }
    >
      <span
        aria-hidden
        style={{
          color: BLUE,
          display: "block",
          clipPath: "inset(0 48% 0 0)",
        }}
      >
        C
      </span>
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          color: RED,
          display: "block",
          clipPath: "inset(0 0 0 48%)",
          textShadow: animated ? "0 6px 12px rgba(227, 24, 55, 0.14)" : "none",
        }}
      >
        C
      </span>
    </motion.span>
  );
}

export function ThinkingAnimation({
  variant = "standard",
  label = "Thinking",
  showLabel = true,
  className = "",
  animated = true,
}: ThinkingAnimationProps) {
  const c = sizeConfig[variant];
  const gradientId = useId().replace(/:/g, "");

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
              "radial-gradient(circle at 28% 30%, rgba(0,102,178,0.12) 0%, rgba(0,102,178,0.06) 34%, rgba(227,24,55,0.06) 62%, transparent 78%)",
            filter: "blur(1px)",
          }}
          animate={
            animated
              ? { scale: [0.98, 1.03, 0.98], opacity: [0.82, 0.96, 0.82] }
              : { scale: 1, opacity: 0.76 }
          }
          transition={
            animated
              ? { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0 }
          }
        />

        <Orbit
          radius={c.orbitRadius}
          strokeWidth={c.strokeWidth}
          arcFraction={c.arcFraction}
          speed={c.speed}
          container={c.container}
          animated={animated}
          gradientId={gradientId}
        />

        <SplitBrandC fontSize={c.fontSize} animated={animated} />
      </div>

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
            {[BLUE, RED, BLUE].map((dotColor, index) => (
              <motion.span
                key={`${dotColor}-${index}`}
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
                        delay: index * 0.2,
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

export function ThinkingInline({
  className = "",
  label,
}: {
  className?: string;
  label?: string;
}) {
  return (
    <motion.div
      className={`thinking-indicator inline-flex items-center gap-2 rounded-full px-3 py-1.5 ${className}`}
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
          {[BLUE, RED, BLUE].map((dotColor, index) => (
            <motion.span
              key={`${dotColor}-${index}`}
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
                delay: index * 0.2,
                ease: "easeInOut",
              }}
            />
          ))}
        </span>
      )}
    </motion.div>
  );
}

export function ThinkingCard({
  className = "",
  title = "Thinking",
  message = "Working through the request",
  description,
}: {
  className?: string;
  title?: string;
  message?: string;
  description?: string;
}) {
  const body = description ?? message;

  return (
    <motion.div
      className={`thinking-indicator flex items-center gap-4 rounded-xl p-4 ${className}`}
      style={{
        background:
          "linear-gradient(180deg, rgba(0,102,178,0.04) 0%, rgba(227,24,55,0.03) 100%), var(--card)",
        border: "1px solid color-mix(in srgb, #0066B2 16%, var(--border))",
        boxShadow:
          "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px -4px rgba(0,0,0,0.06), 0 18px 32px -28px rgba(0,102,178,0.32)",
      }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
    >
      <ThinkingAnimation variant="standard" showLabel={false} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className="mt-1 text-sm text-muted-foreground">{body}</div>
      </div>
    </motion.div>
  );
}
