/**
 * Nav — Sticky top bar with HKI Engineering sub-nav in the center.
 */

import { useLocation } from "wouter";
import { HkiMark, Topbar, cn } from "@hki/ui";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import {
  ENGINEERING_HUB_ROUTE,
  HKI_CUSTODY_PROBLEM_ROUTE,
  HKI_STANDARD_ROUTE,
  HKI_ARCHITECTURE_ROUTE,
} from "@/pages/engineering/constants";

const ENG_NAV = [
  { label: "Hub", href: ENGINEERING_HUB_ROUTE },
  { label: "Problem", href: HKI_CUSTODY_PROBLEM_ROUTE },
  { label: "Standard", href: HKI_STANDARD_ROUTE },
  { label: "Architecture", href: HKI_ARCHITECTURE_ROUTE },
] as const;

interface NavProps {
  onNavigate: (path: string) => void;
}

export function Nav({ onNavigate }: NavProps) {
  const { theme, toggleTheme } = useTheme();
  const [location] = useLocation();

  return (
    <Topbar
      variant="transparent"
      showMenuTrigger={false}
      className="engineering-topbar sticky top-0 z-50"
      leftContent={
        <a
          href="/"
          onClick={e => {
            e.preventDefault();
            onNavigate("/");
          }}
          className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
        >
          <HkiMark size={26} variant="color" />
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-extrabold tracking-tight text-foreground leading-tight">
              HKI
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/50 leading-tight">
              Isolation Standard
            </span>
          </div>
        </a>
      }
      centerContent={
        <nav
          aria-label="Engineering"
          className="flex items-center justify-center"
        >
          <div className="engineering-segmented">
            {ENG_NAV.map(item => {
              const active = location === item.href;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={e => {
                    e.preventDefault();
                    onNavigate(item.href);
                  }}
                  data-active={active}
                  className={cn(
                    "engineering-tab outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                    !active && "text-muted-foreground"
                  )}
                >
                  {item.label}
                </a>
              );
            })}
          </div>
        </nav>
      }
      actions={
        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleTheme}
            className="engineering-icon-button outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? (
              <Moon className="w-4 h-4" />
            ) : (
              <Sun className="w-4 h-4" />
            )}
          </button>
          <a
            href="/login"
            onClick={e => {
              e.preventDefault();
              onNavigate("/login");
            }}
            className="hidden sm:block px-4 py-2 rounded-lg text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign In
          </a>
          <a
            href={HKI_STANDARD_ROUTE}
            onClick={e => {
              e.preventDefault();
              onNavigate(HKI_STANDARD_ROUTE);
            }}
            className="engineering-primary-action min-h-0 px-4 py-2 text-[13px]"
          >
            Read Standard
          </a>
        </div>
      }
    />
  );
}
