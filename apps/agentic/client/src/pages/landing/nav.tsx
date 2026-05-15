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
      variant="blur"
      showMenuTrigger={false}
      className="sticky top-0 z-50 bg-background/85! dark:bg-background/60! backdrop-blur-xl! backdrop-saturate-150 border-border/30! dark:border-white/6!"
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
          <div className="flex items-center gap-0.5 rounded-xl border border-border/40 bg-card/60 p-1 backdrop-blur-sm dark:bg-card/40">
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
                  className={cn(
                    "rounded-lg px-3.5 py-1.5 text-[12px] font-semibold outline-none transition-all duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
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
          <div className="w-px h-5 bg-border/40 mx-1 hidden sm:block" />
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
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
            className="px-5 py-2.5 rounded-xl text-[13px] font-semibold text-primary-foreground bg-primary
                       shadow-sm shadow-primary/20 hover:shadow-md hover:shadow-primary/30
                       hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
          >
            Read Standard
          </a>
        </div>
      }
    />
  );
}
