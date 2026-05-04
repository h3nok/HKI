import * as React from "react";
import { cn } from "../../utils";

export interface DashboardCardProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Leading icon (rendered inside a colored box) */
  icon?: React.ReactNode;
  /** Icon box background color (CSS value, e.g. Tailwind arbitrary or hex) */
  iconBg?: string;
  /** Icon color (CSS value) */
  iconColor?: string;
  /** Card title */
  title: string;
  /** Short description or subtitle */
  description?: string;
  /** Footer content (e.g. status badges) */
  footer?: React.ReactNode;
  /** Trailing element — defaults to a chevron when onClick is provided */
  trailing?: React.ReactNode;
  /** Animation delay in ms (for staggered entrance) */
  animationDelay?: number;
}

/**
 * Clickable dashboard card with icon, title, description, and optional footer.
 * Designed for grid layouts — responsive, accessible, supports dark mode.
 *
 * @example
 * <DashboardCard
 *   icon={<Brain className="w-6 h-6" />}
 *   iconColor="#7c3aed"
 *   title="Agentic AI"
 *   description="6 capabilities"
 *   footer={<StatusMini label="3 MVP" color="emerald" />}
 *   onClick={() => navigate("/capabilities/cat-agentic")}
 * />
 */
export const DashboardCard = React.forwardRef<HTMLButtonElement, DashboardCardProps>(
  (
    {
      icon,
      iconBg,
      iconColor,
      title,
      description,
      footer,
      trailing,
      animationDelay,
      className,
      style,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          "group text-left p-5 rounded-2xl",
          "bg-white dark:bg-white/[0.04]",
          "border border-black/[0.06] dark:border-white/[0.06]",
          "shadow-sm dark:shadow-none",
          "hover:bg-[#fafaf9] dark:hover:bg-white/[0.06]",
          "hover:shadow-md dark:hover:shadow-none",
          "hover:border-black/[0.08] dark:hover:border-white/[0.1]",
          "transition-all duration-200 w-full",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066B2] dark:focus-visible:ring-[#3397D7] focus-visible:ring-offset-2 focus-visible:ring-offset-[#faf9f7] dark:focus-visible:ring-offset-[#111111]",
          className
        )}
        style={{
          ...style,
          ...(animationDelay != null
            ? { animationDelay: `${animationDelay}ms` }
            : {}),
        }}
        {...props}
      >
        <div className="flex items-start justify-between mb-3.5">
          {icon && (
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center [&>svg]:w-5 [&>svg]:h-5"
              style={{
                backgroundColor: iconBg ?? `${iconColor ?? "#0066B2"}12`,
                color: iconColor ?? "#0066B2",
              }}
            >
              {icon}
            </div>
          )}
          {trailing !== undefined ? (
            trailing
          ) : (
            <svg
              className="w-5 h-5 text-[#d1d0cd] dark:text-white/15 group-hover:text-[#6f6e6b] dark:group-hover:text-white/40 group-hover:translate-x-1 transition-all"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          )}
        </div>

        <h2 className="text-lg font-semibold text-[#1a1a19] dark:text-[#E6EDF3] mb-1.5 group-hover:text-[#0066B2] dark:group-hover:text-[#66B1E1] transition-colors">
          {title}
        </h2>

        {description && (
          <p className="text-sm text-[#6f6e6b] dark:text-[#8B949E] mb-4">
            {description}
          </p>
        )}

        {footer && <div className="flex flex-wrap gap-3">{footer}</div>}
      </button>
    );
  }
);

DashboardCard.displayName = "DashboardCard";
