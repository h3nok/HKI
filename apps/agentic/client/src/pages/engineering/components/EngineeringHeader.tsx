import { useCallback, type CSSProperties } from "react";
import { useLocation } from "wouter";
import { Moon, Sun } from "lucide-react";
import { HkiMark, cn } from "@hki/ui";

import { useTheme } from "@/contexts/ThemeContext";
import {
  ENGINEERING_HUB_ROUTE,
  HKI_ARCHITECTURE_ROUTE,
  HKI_CUSTODY_PROBLEM_ROUTE,
  HKI_STANDARD_ROUTE,
} from "@/pages/engineering/constants";
import {
  ARCHITECTURE_COLORS,
  architectureThemeVars,
} from "@/pages/engineering/components/architecture/planes";

const NAV_ITEMS = [
  { label: "Hub", href: ENGINEERING_HUB_ROUTE },
  { label: "Problem", href: HKI_CUSTODY_PROBLEM_ROUTE },
  { label: "Standard", href: HKI_STANDARD_ROUTE },
  { label: "Architecture", href: HKI_ARCHITECTURE_ROUTE },
] as const;

const SURFACE = ARCHITECTURE_COLORS.surface;
const STATUS = ARCHITECTURE_COLORS.status;

function isActiveRoute(current: string, href: string) {
  return current === href;
}

export function EngineeringHeader({ className }: { className?: string }) {
  const [location, setLocation] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const themeVars = architectureThemeVars(theme);

  const navigate = useCallback(
    (path: string) => {
      setLocation(path);
    },
    [setLocation]
  );

  return (
    <header
      className={cn("sticky top-0 z-50 border-b backdrop-blur-sm", className)}
      style={
        {
          ...themeVars,
          background: SURFACE.panel,
          borderColor: SURFACE.border,
        } as CSSProperties
      }
    >
      <div className="mx-auto grid h-14 w-full max-w-7xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-5 sm:px-8">
        <div className="flex min-w-0 items-center gap-3 justify-self-start">
          <a
            href={ENGINEERING_HUB_ROUTE}
            onClick={event => {
              event.preventDefault();
              navigate(ENGINEERING_HUB_ROUTE);
            }}
            className="flex min-w-0 items-center gap-2.5 transition-opacity hover:opacity-80"
            aria-label="Engineering hub"
          >
            <HkiMark size={22} variant="color" />
            <span className="hidden min-w-0 items-baseline gap-2 sm:flex">
              <span
                className="text-sm font-bold tracking-tight"
                style={{ color: SURFACE.text }}
              >
                HKI Engineering
              </span>
              <span
                className="hidden text-[11px] lg:inline"
                style={{ color: SURFACE.textSubtle }}
              >
                AI Work Index
              </span>
            </span>
          </a>
          <span
            aria-hidden
            className="hidden h-4 w-px md:block"
            style={{ background: SURFACE.border }}
          />
          <a
            href="/"
            onClick={event => {
              event.preventDefault();
              navigate("/");
            }}
            className="hidden text-[12px] font-medium transition-opacity hover:opacity-80 md:inline"
            style={{ color: SURFACE.textMuted }}
          >
            ← Landing
          </a>
        </div>

        <nav
          aria-label="Engineering sections"
          className="justify-self-center rounded-xl border p-1 shadow-sm backdrop-blur"
          style={{
            background: SURFACE.panelRaised,
            borderColor: SURFACE.border,
          }}
        >
          <div className="flex items-center justify-center gap-0.5">
            {NAV_ITEMS.map(item => {
              const active = isActiveRoute(location, item.href);
              return (
                <a
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={event => {
                    event.preventDefault();
                    navigate(item.href);
                  }}
                  className={cn(
                    "relative rounded-lg border px-3.5 py-1.5 text-[12px] font-semibold outline-none transition-all duration-150 hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:text-[13px]",
                    active && "shadow-sm"
                  )}
                  style={{
                    background: active ? STATUS.focus : SURFACE.panelRaised,
                    borderColor: active ? STATUS.focus : SURFACE.border,
                    color: active ? SURFACE.panel : SURFACE.textMuted,
                    boxShadow: active
                      ? `0 10px 24px -18px ${STATUS.focus}`
                      : undefined,
                  }}
                >
                  {item.label}
                </a>
              );
            })}
          </div>
        </nav>

        <div className="flex items-center justify-end gap-1 justify-self-end">
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border transition-opacity hover:opacity-80"
            style={{
              background: SURFACE.panelRaised,
              borderColor: SURFACE.border,
              color: SURFACE.textMuted,
            }}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
