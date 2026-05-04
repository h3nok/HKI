/**
 * Agentic ThemeContext — Thin adapter over @hki/ui's shared ThemeProvider.
 *
 * Preserves the `{ theme, toggleTheme, switchable }` API that all Agentic
 * consumers expect, while delegating actual theme management to the shared
 * provider (localStorage key, class toggling, system-theme detection, etc.).
 */
import React from "react";
import {
  ThemeProvider as SharedThemeProvider,
  useTheme as useSharedTheme,
} from "@hki/ui";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  switchable: boolean;
}

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = true,
}: ThemeProviderProps) {
  return (
    <SharedThemeProvider
      defaultTheme={defaultTheme}
      storageKey="agentic-theme"
      attribute="class"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </SharedThemeProvider>
  );
}

export function useTheme(): ThemeContextType {
  const { resolvedTheme, setTheme } = useSharedTheme();
  const theme: Theme = resolvedTheme === "dark" ? "dark" : "light";

  const toggleTheme = React.useCallback(() => {
    setTheme(theme === "light" ? "dark" : "light");
  }, [theme, setTheme]);

  return { theme, toggleTheme, switchable: true };
}
