import * as React from "react";
import { cn } from "../../utils";
import { surface, border, textColor, shadow, focusRing } from "./surfaces";

export interface BentoCardProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Card title */
  title: string;
  /** Description text */
  description?: string;
  /** Leading icon or element */
  icon?: React.ReactNode;
  /** Icon background color (CSS value) */
  iconBg?: string;
  /** Icon foreground color (CSS value) */
  iconColor?: string;
  /** Footer content (badges, status, etc) */
  footer?: React.ReactNode;
  /** Whether this is the "next" active step */
  isActive?: boolean;
  /** Whether this step is done */
  isDone?: boolean;
  /** Visual variant */
  variant?: "default" | "glass" | "gradient";
  /** Grid span - columns */
  colSpan?: 1 | 2 | 3 | 4;
  /** Grid span - rows */
  rowSpan?: 1 | 2;
  /** Animation delay in ms */
  animationDelay?: number;
  /** Gradient direction (for gradient variant) */
  gradient?: "emerald" | "blue" | "violet" | "amber";
}

/**
 * Bento Card — modern asymmetric card for bento grid layouts.
 * Supports glass morphism, gradients, and spanning.
 *
 * @example
 * <BentoCard
 *   title="Gap Analysis"
 *   description="Discover what knowledge your agent needs"
 *   icon={<Sparkles />}
 *   isActive
 *   colSpan={2}
 * />
 */
export const BentoCard = React.forwardRef<HTMLButtonElement, BentoCardProps>(
  (
    {
      title,
      description,
      icon,
      iconBg,
      iconColor,
      footer,
      isActive,
      isDone,
      variant = "default",
      colSpan = 1,
      rowSpan = 1,
      animationDelay,
      gradient = "emerald",
      className,
      style,
      children,
      ...props
    },
    ref
  ) => {
    const gradientStyles = {
      emerald: "bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent dark:from-emerald-500/15 dark:via-emerald-500/5",
      blue: "bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent dark:from-blue-500/15 dark:via-blue-500/5",
      violet: "bg-gradient-to-br from-violet-500/10 via-violet-500/5 to-transparent dark:from-violet-500/15 dark:via-violet-500/5",
      amber: "bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-500/15 dark:via-amber-500/5",
    };

    const colSpanClasses = {
      1: "col-span-1",
      2: "col-span-1 sm:col-span-2",
      3: "col-span-1 sm:col-span-2 lg:col-span-3",
      4: "col-span-1 sm:col-span-2 lg:col-span-4",
    };

    const rowSpanClasses = {
      1: "row-span-1",
      2: "row-span-2",
    };

    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          // Layout
          colSpanClasses[colSpan],
          rowSpanClasses[rowSpan],
          "group relative flex flex-col text-left rounded-3xl p-5",
          "transition-all duration-300 ease-out",
          // Base surface
          variant === "default" && cn(surface.card.both, border.default, shadow.sm),
          variant === "glass" && cn(
            "bg-white/70 dark:bg-white/5 backdrop-blur-xl",
            "border border-white/40 dark:border-white/10",
            shadow.md
          ),
          variant === "gradient" && cn(gradientStyles[gradient], border.default, shadow.sm),
          // Interactive states
          "hover:scale-[1.02] hover:shadow-lg",
          isActive && cn("ring-2 ring-emerald-500/50 dark:ring-emerald-400/50", shadow.md),
          isDone && "opacity-80",
          // Focus
          focusRing,
          className
        )}
        style={{
          ...style,
          ...(animationDelay != null ? { animationDelay: `${animationDelay}ms` } : {}),
        }}
        {...props}
      >
        {/* Glow effect for active state */}
        {isActive && (
          <div className="absolute -inset-0.5 rounded-3xl bg-gradient-to-r from-emerald-500/20 to-blue-500/20 blur opacity-50 group-hover:opacity-75 transition-opacity" />
        )}

        <div className="relative flex flex-col h-full">
          {/* Icon */}
          {icon && (
            <div
              className={cn(
                "w-11 h-11 rounded-2xl flex items-center justify-center mb-4",
                "[&>svg]:w-5 [&>svg]:h-5",
                "transition-transform duration-300 group-hover:scale-110"
              )}
              style={{
                backgroundColor: iconBg ?? (isActive ? "#10b981" : "#10b98115"),
                color: iconColor ?? (isActive ? "#ffffff" : "#10b981"),
              }}
            >
              {icon}
            </div>
          )}

          {/* Content */}
          <div className="flex-1">
            <h3
              className={cn(
                "text-base font-semibold mb-1.5",
                textColor.heading,
                "group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors"
              )}
            >
              {title}
            </h3>
            {description && (
              <p className={cn("text-sm leading-relaxed", textColor.secondary)}>
                {description}
              </p>
            )}
            {children}
          </div>
        </div>
      </button>
    );
  }
);

BentoCard.displayName = "BentoCard";
