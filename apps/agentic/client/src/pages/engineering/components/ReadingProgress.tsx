import { useEffect, useState } from "react";
import { cn } from "@hki/ui";

/**
 * Top-of-page reading-progress bar. 1px primary line that grows from 0% →
 * 100% as the user scrolls through the article.
 *
 * Pass a ref to the element whose scroll progress you want to track. If
 * omitted, it tracks the document.
 */
export function ReadingProgress({
  trackRef,
  className,
}: {
  trackRef?: React.RefObject<HTMLElement | null>;
  className?: string;
}) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const compute = () => {
      const el = trackRef?.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const total = rect.height - window.innerHeight;
        const scrolled = Math.min(Math.max(-rect.top, 0), Math.max(total, 0));
        setProgress(total > 0 ? scrolled / total : 0);
        return;
      }
      const doc = document.documentElement;
      const total = doc.scrollHeight - window.innerHeight;
      setProgress(total > 0 ? window.scrollY / total : 0);
    };

    compute();
    const opts: AddEventListenerOptions = { passive: true };
    window.addEventListener("scroll", compute, opts);
    window.addEventListener("resize", compute, opts);
    return () => {
      window.removeEventListener("scroll", compute);
      window.removeEventListener("resize", compute);
    };
  }, [trackRef]);

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-60 h-0.5",
        className
      )}
    >
      <div
        className="h-full bg-primary transition-[width] duration-150 ease-out"
        style={{ width: `${(progress * 100).toFixed(2)}%` }}
      />
    </div>
  );
}
