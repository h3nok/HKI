import { motion } from "framer-motion";
import { AgenticIcon } from "@/components/ui/icons/AgenticIcon";

const PRIMARY = "var(--primary)";

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
    mark: number;
    spinnerStroke: number;
  }
> = {
  minimal: {
    mark: 28,
    spinnerStroke: 6.5,
  },
  standard: {
    mark: 52,
    spinnerStroke: 5.5,
  },
  expanded: {
    mark: 76,
    spinnerStroke: 4.75,
  },
};

export function ThinkingAnimation({
  variant = "standard",
  label = "Thinking",
  showLabel = true,
  className = "",
  animated = true,
}: ThinkingAnimationProps) {
  const c = sizeConfig[variant];
  const shouldAnimate = animated;

  return (
    <div
      className={`thinking-indicator flex flex-col items-center gap-2.5 ${className}`}
    >
      <motion.div
        className="relative flex items-center justify-center"
        style={{ width: c.mark, height: c.mark }}
        animate={
          shouldAnimate
            ? { opacity: [0.86, 1, 0.86], scale: [0.98, 1.03, 0.98] }
            : { opacity: 1, scale: 1 }
        }
        transition={
          shouldAnimate
            ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0 }
        }
      >
        <AgenticIcon
          size={c.mark}
          animated={shouldAnimate}
          aria-hidden="true"
        />
        {shouldAnimate && (
          <motion.svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            viewBox="0 0 100 100"
            fill="none"
            style={{ width: c.mark, height: c.mark }}
            animate={{ rotate: 360 }}
            transition={{ duration: 1.35, repeat: Infinity, ease: "linear" }}
          >
            <circle
              cx="50"
              cy="50"
              r="44"
              stroke={PRIMARY}
              strokeWidth={c.spinnerStroke}
              strokeLinecap="round"
              strokeDasharray="64 214"
              opacity="0.92"
            />
          </motion.svg>
        )}
      </motion.div>

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
            {[0, 1, 2].map(index => (
              <motion.span
                key={index}
                className="rounded-full"
                style={{
                  width: 3,
                  height: 3,
                  background: PRIMARY,
                }}
                animate={
                  shouldAnimate
                    ? { opacity: [0.2, 1, 0.2], y: [0, -1, 0] }
                    : { opacity: 0.66 }
                }
                transition={
                  shouldAnimate
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
          "linear-gradient(135deg, color-mix(in srgb, var(--primary) 14%, transparent) 0%, color-mix(in srgb, var(--foreground) 5%, transparent) 100%), var(--card)",
        border:
          "1px solid color-mix(in srgb, var(--primary) 28%, var(--border))",
        boxShadow:
          "0 1px 4px rgba(0,0,0,0.06), 0 14px 24px -18px color-mix(in srgb, var(--primary) 52%, transparent)",
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
          {[0, 1, 2].map(index => (
            <motion.span
              key={index}
              className="rounded-full"
              style={{
                width: 4,
                height: 4,
                background: PRIMARY,
              }}
              animate={{ opacity: [0.2, 1, 0.2], y: [0, -1, 0] }}
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
          "linear-gradient(180deg, color-mix(in srgb, var(--primary) 12%, transparent) 0%, color-mix(in srgb, var(--foreground) 4%, transparent) 100%), var(--card)",
        border:
          "1px solid color-mix(in srgb, var(--primary) 30%, var(--border))",
        boxShadow:
          "0 1px 3px rgba(0,0,0,0.06), 0 8px 20px -10px rgba(0,0,0,0.08), 0 20px 34px -24px color-mix(in srgb, var(--primary) 58%, transparent)",
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
