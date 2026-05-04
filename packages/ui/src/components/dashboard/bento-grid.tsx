import React, { useState, useEffect, useRef } from "react";
import { Responsive as ResponsiveGridLayout } from "react-grid-layout";

import type { Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

export interface InteractiveBentoGridProps {
  children: React.ReactNode;
  defaultLayouts: any; // Record<string, Layout[]>
  layoutCacheKey?: string;
  rowHeight?: number;
  margin?: [number, number];
}

export function InteractiveBentoGrid({
  children,
  defaultLayouts,
  layoutCacheKey = "hki_dashboard_layout",
  rowHeight = 60,
  margin = [16, 16],
}: InteractiveBentoGridProps) {
  // Try to load cached layout from localStorage, otherwise fallback to default
  const [layouts, setLayouts] = useState(() => {
    try {
      const cached = localStorage.getItem(layoutCacheKey);
      if (cached) return JSON.parse(cached);
    } catch (e) {
      console.error("Failed to parse local layout", e);
    }
    return defaultLayouts;
  });

  // Track layout changes
  const handleLayoutChange = (_layout: unknown, allLayouts: unknown) => {
    setLayouts(allLayouts as Record<string, Layout[]>);
    localStorage.setItem(layoutCacheKey, JSON.stringify(allLayouts));
  };

  const resetLayout = () => {
    setLayouts(defaultLayouts);
    localStorage.removeItem(layoutCacheKey);
  };

  // Custom Width Provider Implementation
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>(0);

  useEffect(() => {
    if (!containerRef.current) return;

    // Set initial width
    setWidth(containerRef.current.offsetWidth);

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        // Debounce or directly set width (RGL handles inner debouncing as well)
        setWidth(entry.contentRect.width);
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="absolute top-2 right-4 z-10 flex gap-2">
        <button
          onClick={resetLayout}
          className="text-xs px-2 py-1 rounded bg-muted/50 text-muted-foreground hover:bg-muted transition-colors opacity-0 hover:opacity-100"
        >
          Reset Grid
        </button>
      </div>

      {width > 0 && (
        <ResponsiveGridLayout
          className="layout -mx-2"
          width={width}
          layouts={layouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={rowHeight}
          onLayoutChange={handleLayoutChange}
          // @ts-expect-error - draggableHandle is valid but missing in old type defs
          draggableHandle=".dashboard-drag-handle"
          isResizable={true}
          margin={margin}
        >
          {React.Children.toArray(children).map(child => {
            if (!React.isValidElement(child)) return null;
            // React.Children.toArray adds prefixes like .$ or .0 to keys.
            // We read the explicit data-grid-id if provided to guarantee exact string matching.
            const gridKey =
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (child as any).props["data-grid-id"] ||
              String((child as React.ReactElement).key).replace(/^\.\$?/, "");

            return (
              <div key={gridKey} className="w-full h-full relative group">
                {/* Do not render drag handle on static items */}
                {/* We can infer this roughly if it's the hero, but let's just keep it simple or hide via CSS if static */}
                <DragHandle />
                <div className="w-full h-full overflow-hidden">{child}</div>
              </div>
            );
          })}
        </ResponsiveGridLayout>
      )}
    </div>
  );
}

// Reusable drag handle component
function DragHandle() {
  return (
    <div className="dashboard-drag-handle absolute top-0 inset-x-0 h-6 cursor-grab active:cursor-grabbing z-100 pointer-events-auto opacity-0 group-hover:opacity-100 transition-all duration-300 flex justify-center items-start pt-1.5 backdrop-blur-[2px] rounded-t-xl bg-linear-to-b from-black/5 to-transparent dark:from-white/5">
      <div className="w-10 h-1 rounded-full bg-black/20 dark:bg-white/20 shadow-sm" />
    </div>
  );
}
