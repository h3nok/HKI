import * as React from "react";
import { cn } from "../../utils";

export interface PageHeaderProps {
  /** Lucide icon component rendered in the accent badge */
  icon: React.ReactNode;
  /** Small uppercase label above the title (e.g. "Innovation Portfolio") */
  subtitle?: string;
  /** Main page heading */
  title: string;
  /** Short description below the accent bar */
  description?: string;
  /** Right-aligned actions slot */
  actions?: React.ReactNode;
  /** Extra classNames on the wrapper */
  className?: string;
}

/**
 * Consistent page header used across all IPMS pages.
 * Renders: icon badge + subtitle + title + blue accent bar + description.
 */
export function PageHeader({
  icon,
  subtitle,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-8", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "#0066B214", color: "#0066B2" }}
          >
            {icon}
          </div>
          <div>
            {subtitle && (
              <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#0066B2] dark:text-[#3397D7] block mb-0.5">
                {subtitle}
              </span>
            )}
            <h1 className="text-[22px] font-bold tracking-tight text-[#1a1a19] dark:text-[#f5f4f1] leading-tight">
              {title}
            </h1>
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      {description && (
        <div className="mt-3 pl-14">
          <div className="h-0.5 w-8 rounded-full mb-2.5" style={{ background: "#0066B2" }} />
          <p className="text-[13px] text-[#6f6e6b] dark:text-[#a3a29f] max-w-lg leading-relaxed">
            {description}
          </p>
        </div>
      )}
    </div>
  );
}
