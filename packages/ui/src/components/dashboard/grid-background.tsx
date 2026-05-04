import * as React from "react";
import { cn } from "../../utils";

export interface GridBackgroundProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Grid line color for light mode (warm neutral default) */
  lightColor?: string;
  /** Grid line color for dark mode (perceptible but quiet) */
  darkColor?: string;
  /** Grid cell size in pixels */
  size?: number;
  /** Opacity in light mode (0–1) */
  lightOpacity?: number;
  /** Opacity in dark mode (0–1) */
  darkOpacity?: number;
  /** Current theme — drives color selection */
  theme?: "light" | "dark";
}

/**
 * Full-screen fixed grid background pattern.
 * Uses warm neutral grid lines (not cold slate) for No-Washout design.
 * Renders two layers: grid lines + gradient fade overlay.
 *
 * @example
 * <GridBackground theme={theme} />
 * <GridBackground size={48} lightOpacity={0.3} />
 */
export function GridBackground({
  lightColor = "#d1d0cd",
  darkColor = "#333333",
  size = 40,
  lightOpacity = 0.18,
  darkOpacity = 0.10,
  theme,
  className,
  ...props
}: GridBackgroundProps) {
  const color = theme === "dark" ? darkColor : lightColor;
  const opacity = theme === "dark" ? darkOpacity : lightOpacity;

  return (
    <>
      <div
        className={cn("absolute inset-0 z-0 pointer-events-none transition-opacity duration-500", className)}
        style={{
          backgroundImage: `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`,
          backgroundSize: `${size}px ${size}px`,
          opacity,
        }}
        aria-hidden="true"
        role="presentation"
        {...props}
      />
      <div
        className="absolute inset-0 z-0 pointer-events-none bg-gradient-to-b from-[#faf9f7] via-[#faf9f7]/80 to-[#faf9f7] dark:from-[#111111] dark:via-[#111111]/80 dark:to-[#111111]"
        aria-hidden="true"
      />
    </>
  );
}
