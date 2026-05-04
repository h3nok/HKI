import { useEffect, useRef, type CSSProperties } from "react";
import { motion } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1] as const;

export function HealthRing({
  score,
  color,
  size = 120,
}: {
  score: number;
  color: string;
  size?: number;
}) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const strokeDashoffset = c - (score / 100) * c;
  const valueFontPx = Math.max(24, Math.round(size * 0.42));
  const unitFontPx = Math.max(10, Math.round(size * 0.16));

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth="5"
          className="stroke-black/5 dark:stroke-white/8"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          stroke={color}
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.2, ease: EASE, delay: 0.3 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <AnimatedNumber
          value={score}
          className="font-semibold leading-none tabular-nums text-foreground"
          style={{ fontSize: valueFontPx }}
        />
        <span
          className="font-medium text-muted-foreground mt-0.5"
          style={{ fontSize: unitFontPx }}
        >
          / 100
        </span>
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
    const duration = 800;
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
