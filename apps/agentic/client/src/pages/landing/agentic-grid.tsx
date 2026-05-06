/**
 * AgenticGrid — Uniform dot-grid canvas background.
 *
 * Regular grid of small dots in HKI brand colors (Iris teal / Pulse amber):
 *   • Subtle per-dot brightness variation (slow, staggered phase)
 *   • Soft radial cursor spotlight — iris teal at center, pulse amber at edge
 *   • Scroll-aware fade, reduced-motion support
 *
 * No distortion. No wandering nodes. No waves.
 * Single <canvas>, requestAnimationFrame, DPR-aware.
 */

import { useRef, useEffect, useCallback } from "react";

const CELL = 28; // grid spacing (px)
const DOT_R = 1.1; // base dot radius
const CURSOR_R = 210; // spotlight radius

/** Read a CSS custom property as an "r,g,b" string. */
function tokenRgb(name: string): string {
  if (typeof window === "undefined") return "0,0,0";
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  const hex = raw.startsWith("#") ? raw.slice(1) : "";
  if (hex.length === 3)
    return hex
      .split("")
      .map(ch => parseInt(`${ch}${ch}`, 16))
      .join(",");
  if (hex.length >= 6)
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ].join(",");
  return "0,0,0";
}

export function AgenticGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: -9999, y: -9999 });
  const smooth = useRef({ x: -9999, y: -9999 });
  const active = useRef(false);
  const intensity = useRef(0);
  const raf = useRef(0);
  const dark = useRef(false);
  const reduced = useRef(false);
  const frame = useRef(0);
  const scrollY = useRef(0);

  const draw = useCallback(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;

    const dpr = devicePixelRatio || 1;
    const w = cvs.clientWidth;
    const h = cvs.clientHeight;

    if (cvs.width !== w * dpr || cvs.height !== h * dpr) {
      cvs.width = w * dpr;
      cvs.height = h * dpr;
      ctx.scale(dpr, dpr);
    }

    frame.current++;
    const t = frame.current * 0.016;
    const red = reduced.current;
    const isDark = dark.current;
    const s = smooth.current;
    const m = mouse.current;

    if (red) {
      s.x = m.x;
      s.y = m.y;
      intensity.current = active.current ? 1 : 0;
    } else {
      intensity.current +=
        ((active.current ? 1 : 0) - intensity.current) * 0.06;
      s.x += (m.x - s.x) * 0.08;
      s.y += (m.y - s.y) * 0.08;
    }

    const int = intensity.current;
    const hov = int > 0.01;
    const mx = s.x;
    const my = s.y;
    const fade = Math.max(0.15, 1 - scrollY.current / 700);

    ctx.clearRect(0, 0, w, h);

    // Brand color tokens (read once per frame — cheap string lookup)
    const irisRgb = tokenRgb("--hki-iris-500"); // deep teal  #0E7C7B
    const pulseRgb = tokenRgb("--hki-pulse-500"); // warm amber #E07A1F

    const cols = Math.ceil(w / CELL) + 2;
    const rows = Math.ceil(h / CELL) + 2;

    for (let col = 0; col <= cols; col++) {
      for (let row = 0; row <= rows; row++) {
        const x = col * CELL;
        const y = row * CELL;

        // Slow, staggered per-dot breathing
        const phase = (col * 2.3 + row * 3.7) % (Math.PI * 2);
        const breath = red ? 0 : Math.sin(t * 0.4 + phase) * 0.5 + 0.5;

        // Cursor proximity [0,1]
        const dx = x - mx;
        const dy = y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const prox = hov ? Math.max(0, 1 - dist / CURSOR_R) * int : 0;

        // Within the spotlight: iris teal at center, pulse amber toward edge
        // t = 0 → pure iris, t = 1 → pure pulse (blends across the spotlight radius)
        const colorT = prox > 0 ? 1 - prox : 0; // 0 at cursor center, 1 at radius edge
        const rgb = colorT < 0.5 ? irisRgb : pulseRgb;

        const baseAlpha =
          ((isDark ? 0.14 : 0.09) + breath * (isDark ? 0.05 : 0.03)) * fade;
        const glowAlpha = prox * prox * (isDark ? 0.72 : 0.55) * fade;
        const r = DOT_R + prox * 1.3;

        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle =
          prox > 0.02
            ? `rgba(${rgb},${baseAlpha + glowAlpha})`
            : `rgba(${irisRgb},${baseAlpha})`;
        ctx.fill();
      }
    }

    raf.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;

    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    reduced.current = mq.matches;
    const onMq = () => {
      reduced.current = mq.matches;
    };
    mq.addEventListener("change", onMq);

    const checkDark = () => {
      dark.current = document.documentElement.classList.contains("dark");
    };
    checkDark();
    const obs = new MutationObserver(checkDark);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const onScroll = () => {
      scrollY.current = window.scrollY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    const onMove = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (el?.closest("[data-no-grid]")) {
        if (active.current) {
          active.current = false;
          mouse.current = { x: -9999, y: -9999 };
        }
        return;
      }
      const rect = cvs.getBoundingClientRect();
      mouse.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      active.current = true;
    };
    const onLeave = () => {
      active.current = false;
      mouse.current = { x: -9999, y: -9999 };
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);
    raf.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("scroll", onScroll);
      obs.disconnect();
      mq.removeEventListener("change", onMq);
    };
  }, [draw]);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-background">
      {/* Ambient base — light: faint iris blush at top */}
      <div
        className="absolute inset-0 dark:opacity-0 transition-opacity duration-500"
        style={{
          background: `
            radial-gradient(ellipse 80% 40% at 50% 0%, color-mix(in srgb, var(--hki-iris-500) 5%, transparent) 0%, transparent 55%),
            radial-gradient(ellipse 50% 30% at 90% 60%, color-mix(in srgb, var(--hki-pulse-500) 3%, transparent) 0%, transparent 50%),
            linear-gradient(180deg, var(--background) 0%, var(--surface-ground) 100%)
          `,
        }}
      />
      {/* Ambient base — dark: iris crown, pulse accent */}
      <div
        className="absolute inset-0 dark:opacity-100 opacity-0 transition-opacity duration-500"
        style={{
          background: `
            radial-gradient(ellipse 80% 45% at 50% 0%, color-mix(in srgb, var(--hki-iris-500) 13%, transparent) 0%, transparent 55%),
            radial-gradient(ellipse 55% 35% at 85% 70%, color-mix(in srgb, var(--hki-pulse-500) 7%, transparent) 0%, transparent 50%),
            linear-gradient(180deg, var(--background) 0%, var(--surface-ground) 40%, var(--background) 100%)
          `,
        }}
      />

      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        aria-hidden="true"
      />

      {/* Edge fades */}
      <div className="absolute left-0 right-0 top-0 h-[18%] bg-linear-to-b from-background via-background/60 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-[10%] bg-linear-to-t from-background to-transparent pointer-events-none" />

      {/* Film grain */}
      <div
        className="absolute inset-0 opacity-[0.025] dark:opacity-[0.045]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' seed='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "256px 256px",
        }}
      />
    </div>
  );
}
