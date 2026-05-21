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
import { architectureThemeVars } from "@/pages/engineering/components/architecture/planes";

const NAV_ITEMS = [
  { label: "Hub", href: ENGINEERING_HUB_ROUTE },
  { label: "Problem", href: HKI_CUSTODY_PROBLEM_ROUTE },
  { label: "Standard", href: HKI_STANDARD_ROUTE },
  { label: "Architecture", href: HKI_ARCHITECTURE_ROUTE },
] as const;

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
      className={cn("engineering-topbar sticky top-0 z-50 border-b", className)}
      style={themeVars as CSSProperties}
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
              <span className="text-sm font-bold tracking-tight text-foreground">
                HKI Engineering
              </span>
              <span className="hidden text-[11px] text-muted-foreground lg:inline">
                AI Work Index
              </span>
            </span>
          </a>
          <span aria-hidden className="hidden h-4 w-px bg-border/70 md:block" />
          <a
            href="/"
            onClick={event => {
              event.preventDefault();
              navigate("/");
            }}
            className="hidden text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground md:inline"
          >
            ← Landing
          </a>
        </div>

        <nav aria-label="Engineering sections" className="justify-self-center">
          <div className="engineering-segmented">
            {NAV_ITEMS.map(item => {
              const active = isActiveRoute(location, item.href);
              return (
                <a
                  key={item.href}
                  href={item.href}
                  data-active={active}
                  aria-current={active ? "page" : undefined}
                  onClick={event => {
                    event.preventDefault();
                    navigate(item.href);
                  }}
                  className="engineering-tab outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
            className="engineering-icon-button outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
