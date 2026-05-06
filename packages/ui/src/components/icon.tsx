/**
 * Atelier <Icon /> — single wrapper for HKI custom icons + Lucide.
 *
 * - HKI domain icons (knowledge/agent/pipeline/...) ship inline in the bundle.
 * - Lucide icons load lazily via dynamicIconImports — only icons used pay cost.
 * - Tone & size enums map to currentColor variants so icons inherit semantic colour.
 */
import * as React from "react";

import { cn } from "../utils";
import { HKI_ICON_REGISTRY, type HkiIconName } from "./icons/hki-icons";

const SIZE = { xs: 14, sm: 16, md: 20, lg: 24 } as const;
const TONE = {
  default: "text-foreground",
  muted: "text-muted-foreground",
  brand: "text-primary",
  danger: "text-destructive",
  success: "text-success",
  warning: "text-warning",
  info: "text-info",
} as const;

export type IconSize = keyof typeof SIZE;
export type IconTone = keyof typeof TONE;

/** Lucide icon name — typed loosely so callers can pass any Lucide identifier without us
 *  forcing the entire icon manifest into the type graph. */
export type LucideName = string;

export interface IconProps extends Omit<React.SVGProps<SVGSVGElement>, "name"> {
  name: HkiIconName | LucideName;
  size?: IconSize;
  tone?: IconTone;
  /** Force HKI custom registry lookup even if `name` collides with a Lucide identifier. */
  hki?: boolean;
}

type LucideComp = React.ComponentType<
  React.SVGProps<SVGSVGElement> & { size?: number }
>;
const lucideCache = new Map<string, React.LazyExoticComponent<LucideComp>>();

function getLucide(name: string) {
  let entry = lucideCache.get(name);
  if (!entry) {
    entry = React.lazy(async () => {
      const mod = await import("lucide-react");
      const Comp = (mod as unknown as Record<string, LucideComp>)[name];
      if (!Comp) {
        const Fallback: LucideComp = (props) => (
          <svg viewBox="0 0 24 24" {...props} />
        );
        return { default: Fallback };
      }
      return { default: Comp };
    });
    lucideCache.set(name, entry);
  }
  return entry;
}

export const Icon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ name, size = "md", tone = "default", hki, className, ...rest }, ref) => {
    const px = SIZE[size];
    const cls = cn(TONE[tone], "shrink-0", className);

    const isHki = hki || name in HKI_ICON_REGISTRY;
    if (isHki) {
      const Comp = HKI_ICON_REGISTRY[name as HkiIconName];
      return (
        <Comp
          ref={ref as React.Ref<SVGSVGElement>}
          width={px}
          height={px}
          className={cls}
          {...rest}
        />
      );
    }

    const Lazy = getLucide(name);
    return (
      <React.Suspense
        fallback={
          <svg
            width={px}
            height={px}
            className={cls}
            aria-hidden="true"
            {...rest}
          />
        }
      >
        <Lazy width={px} height={px} className={cls} />
      </React.Suspense>
    );
  },
);
Icon.displayName = "Icon";

export { HKI_ICON_REGISTRY };
export type { HkiIconName };
