"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useTheme } from "../providers/theme-provider";

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={resolvedTheme}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover, var(--card))",
          "--normal-text": "var(--popover-foreground, var(--foreground))",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
export type { ToasterProps };
