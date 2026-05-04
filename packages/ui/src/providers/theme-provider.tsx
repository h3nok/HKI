"use client";

import * as React from "react";

// ============================================================================
// Types
// ============================================================================

export type Theme = "light" | "dark" | "system";

export interface ThemeProviderProps {
  children: React.ReactNode;
  /** Default theme */
  defaultTheme?: Theme;
  /** Storage key for persisting theme */
  storageKey?: string;
  /** Attribute to set on document element */
  attribute?: "class" | "data-theme";
  /** Enable system theme detection */
  enableSystem?: boolean;
  /** Disable transitions during theme change */
  disableTransitionOnChange?: boolean;
}

export interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  themes: Theme[];
}

// ============================================================================
// Context
// ============================================================================

const ThemeContext = React.createContext<ThemeContextValue | undefined>(
  undefined
);

// ============================================================================
// Hook
// ============================================================================

export function useTheme(): ThemeContextValue {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "ui-theme",
  attribute = "class",
  enableSystem = true,
  disableTransitionOnChange = false,
}: ThemeProviderProps): React.ReactElement {
  const [theme, setThemeState] = React.useState<Theme>(() => {
    if (typeof window === "undefined") return defaultTheme;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored && ["light", "dark", "system"].includes(stored)) {
        return stored as Theme;
      }
    } catch {
      // localStorage not available
    }
    return defaultTheme;
  });

  const [resolvedTheme, setResolvedTheme] = React.useState<"light" | "dark">(
    () => {
      if (typeof window === "undefined") return "light";
      if (theme === "system") {
        return window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      }
      return theme === "dark" ? "dark" : "light";
    }
  );

  // Apply theme to document
  const applyTheme = React.useCallback(
    (newTheme: "light" | "dark") => {
      if (typeof window === "undefined") return;

      const root = document.documentElement;

      if (disableTransitionOnChange) {
        root.style.setProperty("transition", "none");
      }

      if (attribute === "class") {
        root.classList.remove("light", "dark");
        root.classList.add(newTheme);
      } else {
        root.setAttribute("data-theme", newTheme);
      }

      if (disableTransitionOnChange) {
        // Force reflow
        void root.offsetHeight;
        root.style.removeProperty("transition");
      }

      setResolvedTheme(newTheme);
    },
    [attribute, disableTransitionOnChange]
  );

  // Handle system theme changes
  React.useEffect(() => {
    if (!enableSystem || theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e: MediaQueryListEvent) => {
      applyTheme(e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme, enableSystem, applyTheme]);

  // Apply theme on mount and theme change
  React.useEffect(() => {
    if (theme === "system" && enableSystem) {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";
      applyTheme(systemTheme);
    } else {
      applyTheme(theme === "dark" ? "dark" : "light");
    }
  }, [theme, enableSystem, applyTheme]);

  const setTheme = React.useCallback(
    (newTheme: Theme) => {
      try {
        localStorage.setItem(storageKey, newTheme);
      } catch {
        // localStorage not available
      }
      setThemeState(newTheme);
    },
    [storageKey]
  );

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      themes: ["light", "dark", "system"],
    }),
    [theme, resolvedTheme, setTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

ThemeProvider.displayName = "ThemeProvider";

// ============================================================================
// Theme Toggle Component
// ============================================================================

export interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps): React.ReactElement {
  const { theme, setTheme, themes } = useTheme();

  const cycleTheme = () => {
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    const nextTheme = themes[nextIndex];
    if (nextTheme) {
      setTheme(nextTheme);
    }
  };

  return (
    <button
      onClick={cycleTheme}
      className={className}
      aria-label={`Current theme: ${theme}. Click to change.`}
      type="button"
    >
      {theme === "light" && "☀️"}
      {theme === "dark" && "🌙"}
      {theme === "system" && "💻"}
    </button>
  );
}

ThemeToggle.displayName = "ThemeToggle";

export default ThemeProvider;
