import { cn } from "../../utils";

export interface ThemeToggleProps {
  /** Current theme */
  theme: "light" | "dark";
  /** Callback to toggle theme */
  onToggle: () => void;
  /** Additional class names */
  className?: string;
}

/**
 * Sun/Moon theme toggle button.
 *
 * @example
 * <ThemeToggle theme={theme} onToggle={toggleTheme} />
 */
export function ThemeToggle({ theme, onToggle, className }: ThemeToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "p-2.5 rounded-xl text-[#8a8986] dark:text-[#6f6e6b]",
        "hover:text-[#3f3e3d] dark:hover:text-[#d1d0cd]",
        "hover:bg-white dark:hover:bg-[#242424]",
        "border border-transparent hover:border-[#e0dfdc] dark:hover:border-[#333333]",
        "transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066B2] dark:focus-visible:ring-[#3397D7] focus-visible:ring-offset-2",
        className
      )}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      )}
    </button>
  );
}
