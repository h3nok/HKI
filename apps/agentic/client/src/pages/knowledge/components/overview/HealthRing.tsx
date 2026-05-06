import { useEffect, useRef, type CSSProperties } from "react";

export function HealthRing({
  score,
  color: _color,
  size = 120,
}: {
  score: number;
  color: string;
  size?: number;
}) {
  void _color;
  const valueFontPx = Math.max(20, Math.round(size * 0.32));
  const unitFontPx = Math.max(10, Math.round(size * 0.12));
  const trackHeight = Math.max(4, Math.round(size * 0.05));
  const fillPct = Math.max(0, Math.min(100, score));

  return (
    <div className="flex flex-col gap-2" style={{ width: size }}>
      <div className="flex items-baseline gap-1.5">
        <AnimatedNumber
          value={score}
          className="font-extrabold leading-none tabular-nums tracking-normal text-foreground"
          style={{ fontSize: valueFontPx }}
        />
        <span
          className="font-medium text-muted-foreground tabular-nums"
          style={{ fontSize: unitFontPx }}
        >
          / 100
        </span>
      </div>
      <div
        className="w-full rounded-full bg-muted/60 overflow-hidden"
        style={{ height: trackHeight }}
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full bg-primary transition-[width] duration-700 ease-out"
          style={{ width: `${fillPct}%` }}
        />
      </div>
    </div>
  );
}

function AnimatedNumber({
  value,
  className,
  style,
}: {
  value: number;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const prevValue = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const node = el;
    const start = prevValue.current;
    const end = value;
    const duration = 600;
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = String(Math.round(start + (end - start) * eased));
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
    prevValue.current = value;
  }, [value]);

  return (
    <span ref={ref} className={className} style={style}>
      0
    </span>
  );
}
