import { type ElementType, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@hki/ui";

/**
 * Reading-page layout primitives.
 *
 * The article column itself is *not* width-constrained — every prose block
 * self-constrains via <ProseBlock>, and rich/interactive blocks use
 * <WideBlock> to span the full article column width.
 *
 * This avoids viewport-width tricks that fight the grid layout and
 * break on inner page padding.
 */

const PROSE_MAX = "max-w-[68ch]";

export function ProseBlock({
  children,
  className,
  as: Tag = "div",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: ElementType;
} & HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={cn("mx-auto w-full", PROSE_MAX, className)} {...rest}>
      {children}
    </Tag>
  );
}

/**
 * Spans the article column's full width (no prose cap), with a sensible
 * upper bound so it never gets gigantic on ultra-wide displays.
 */
export function WideBlock({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-370", className)}>{children}</div>
  );
}
