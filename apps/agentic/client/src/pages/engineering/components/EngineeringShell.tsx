import { type CSSProperties, type ReactNode, useCallback } from "react";
import { useLocation } from "wouter";
import { ArrowRight } from "lucide-react";
import { HkiMark, cn } from "@hki/ui";

import { ENGINEERING_HUB_ROUTE } from "@/pages/engineering/constants";
import { useTheme } from "@/contexts/ThemeContext";
import {
  ARCHITECTURE_COLORS,
  architectureThemeVars,
} from "@/pages/engineering/components/architecture/planes";
import { EngineeringHeader } from "./EngineeringHeader";

/**
 * Shared page shell for all four engineering pages.
 *
 * Standard layout (fullViewport=false):
 *   flex min-h-screen flex-col
 *   → EngineeringHeader (sticky)
 *   → <main className="flex-1"> [contentClassName]
 *       [children]
 *   → <footer> with HKI mark + hub link (or custom slots)
 *
 * Full-viewport layout (fullViewport=true) — used by Architecture:
 *   flex h-screen flex-col overflow-hidden
 *   → EngineeringHeader (sticky)
 *   → optional contextStrip
 *   → <main className="min-h-0 flex-1 flex flex-col overflow-hidden">
 *       [children]
 *   (no footer — diagram owns the full surface)
 */
export function EngineeringShell({
  children,
  fullViewport = false,
  contextStrip,
  footerLeft,
  footerRight,
  contentClassName,
}: {
  children: ReactNode;
  fullViewport?: boolean;
  /** Slim bar between header and main — used by Architecture for title + path pills */
  contextStrip?: ReactNode;
  /** Left slot in the standard footer (defaults to HKI mark + page label) */
  footerLeft?: ReactNode;
  /** Right slot in the standard footer (defaults to back-to-hub link) */
  footerRight?: ReactNode;
  /** Extra className on the <main> element */
  contentClassName?: string;
}) {
  const [, setLocation] = useLocation();
  const { theme } = useTheme();
  const themeVars = architectureThemeVars(theme);
  const navigate = useCallback((p: string) => setLocation(p), [setLocation]);

  return (
    <div
      className={cn(
        "flex flex-col",
        !fullViewport && "bg-background",
        fullViewport ? "h-screen overflow-hidden" : "min-h-screen"
      )}
      style={
        fullViewport
          ? ({
              ...themeVars,
              background: ARCHITECTURE_COLORS.surface.page,
            } as CSSProperties)
          : (themeVars as CSSProperties)
      }
    >
      <EngineeringHeader />

      {contextStrip}

      <main
        className={cn(
          fullViewport
            ? "min-h-0 flex-1 flex flex-col overflow-hidden"
            : "flex-1",
          contentClassName
        )}
      >
        {children}
      </main>

      {!fullViewport && (
        <footer
          className="border-t"
          style={{ borderColor: ARCHITECTURE_COLORS.surface.border }}
        >
          <div
            className="mx-auto flex min-h-12 w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-3 text-xs sm:px-8"
            style={{ color: ARCHITECTURE_COLORS.surface.textMuted }}
          >
            {footerLeft ?? (
              <div className="flex items-center gap-2">
                <HkiMark size={14} variant="color" />
                <span>HKI Engineering</span>
              </div>
            )}
            {footerRight ?? (
              <a
                href={ENGINEERING_HUB_ROUTE}
                onClick={event => {
                  event.preventDefault();
                  navigate(ENGINEERING_HUB_ROUTE);
                }}
                className="inline-flex items-center gap-1.5 font-medium outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                style={{ color: ARCHITECTURE_COLORS.surface.textMuted }}
              >
                Back to hub
                <ArrowRight className="h-3 w-3" />
              </a>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}
