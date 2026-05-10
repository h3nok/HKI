import type { HTMLAttributes, MouseEventHandler, ReactNode } from "react";
import { cn } from "@hki/ui";

interface AppSidebarBrandProps {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  collapsed?: boolean;
  href?: string;
  ariaLabel: string;
  className?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement | HTMLButtonElement>;
}

function brandContent({
  icon,
  eyebrow,
  title,
  collapsed,
}: Pick<AppSidebarBrandProps, "icon" | "eyebrow" | "title" | "collapsed">) {
  return (
    <>
      <span
        className="hki-sidebar-brand__mark flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/8 text-primary"
        aria-hidden="true"
      >
        {icon}
      </span>
      {!collapsed && (
        <span className="hki-sidebar-brand__copy flex min-w-0 flex-1 flex-col justify-center gap-1">
          <span className="hki-sidebar-brand__eyebrow block truncate font-mono text-[10px] font-bold uppercase leading-none tracking-[0.18em] text-muted-foreground">
            {eyebrow}
          </span>
          <span className="hki-sidebar-brand__title block truncate text-[17px] font-bold leading-[1.05] tracking-normal text-foreground">
            {title}
          </span>
        </span>
      )}
    </>
  );
}

export function AppSidebarBrand({
  icon,
  eyebrow,
  title,
  collapsed = false,
  href,
  ariaLabel,
  className,
  onClick,
}: AppSidebarBrandProps) {
  const classes = cn(
    "hki-sidebar-brand relative isolate flex min-h-16 w-full items-center overflow-hidden rounded-xl border border-border/70 bg-card px-3 py-2.5 text-left text-foreground no-underline shadow-none transition-colors duration-150 hover:border-primary/30 hover:bg-primary/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
    collapsed
      ? "hki-sidebar-brand--collapsed min-h-12 justify-center px-1.5 py-1.5"
      : "gap-3",
    className
  );
  const content = brandContent({ icon, eyebrow, title, collapsed });

  if (href) {
    return (
      <a
        href={href}
        onClick={onClick as MouseEventHandler<HTMLAnchorElement> | undefined}
        className={classes}
        aria-label={ariaLabel}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick as MouseEventHandler<HTMLButtonElement> | undefined}
      className={classes}
      aria-label={ariaLabel}
    >
      {content}
    </button>
  );
}

export function AppSidebarSectionLabel({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn("hki-sidebar-section-label", className)} {...props} />
  );
}

export function AppPanel({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("hki-panel rounded-2xl", className)} {...props} />;
}

export function AppInset({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("hki-inset rounded-xl", className)} {...props} />;
}

export function AppAiText({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("hki-ai-text", className)} {...props} />;
}
