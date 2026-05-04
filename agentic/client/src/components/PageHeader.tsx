/**
 * Agentic Page Header
 * Executive-grade hero section — lifted card, HKI Blue accents.
 * Mirrors the IPMS PageHeader component.
 */

import { cn, COSTCO_BLUE } from "@hki/ui";

export interface PageHeaderProps {
  icon: React.ReactNode;
  subtitle?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export default function PageHeader({
  icon,
  subtitle,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "relative rounded-2xl mb-10 px-7 py-6",
        "bg-background/80",
        "border border-black/6 dark:border-white/[0.04]",
        "shadow-[0_1px_2px_rgba(0,0,0,0.04),0_2px_8px_rgba(0,0,0,0.04)]",
        "dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),0_4px_16px_rgba(0,0,0,0.15)]",
        "backdrop-blur-xl",
        className
      )}
    >
      {/* Blue top accent */}
      <div
        className="absolute top-0 left-6 right-6 h-[2px] rounded-b-full"
        style={{
          background: `linear-gradient(90deg, ${COSTCO_BLUE}, color-mix(in srgb, ${COSTCO_BLUE} 70%, white))`,
        }}
      />

      <div className="flex items-start justify-between gap-4 flex-wrap">
        {/* Left: icon + heading */}
        <div className="flex items-start gap-5 min-w-0">
          <div
            className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
              "bg-primary/10 dark:bg-primary/20",
              "text-primary dark:text-primary",
              "ring-1 ring-primary/15 dark:ring-primary/30"
            )}
          >
            {icon}
          </div>
          <div className="min-w-0">
            {subtitle && (
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary block mb-1">
                {subtitle}
              </span>
            )}
            <h1 className="text-2xl font-bold tracking-tight text-foreground leading-tight">
              {title}
            </h1>
            {description && (
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-xl">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Right: actions */}
        {actions && (
          <div className="flex items-center gap-3 shrink-0 pt-1">{actions}</div>
        )}
      </div>
    </div>
  );
}
