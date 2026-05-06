/**
 * Nav — Sticky top bar using the shared Topbar from @hki/ui.
 * Warm, token-based styling consistent with the rest of the platform.
 */

import { HkiMark, Topbar } from "@hki/ui";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { HKI_STANDARD_ROUTE } from "@/pages/engineering/constants";

interface NavProps {
  onNavigate: (path: string) => void;
}

export function Nav({ onNavigate }: NavProps) {
  const { theme, toggleTheme } = useTheme();

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
      actions={
        <div className="flex items-center gap-1.5">
          <a
            href="#features"
            className="hidden md:block px-3 py-2 rounded-lg text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
          >
            Framework
          </a>
          <a
            href="#readiness"
            className="hidden md:block px-3 py-2 rounded-lg text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
          >
            Conformance
          </a>
          <a
            href="#roles"
            className="hidden lg:block px-3 py-2 rounded-lg text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
          >
            Roles
          </a>
          <div className="w-px h-5 bg-border/40 mx-1.5 hidden sm:block" />
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
