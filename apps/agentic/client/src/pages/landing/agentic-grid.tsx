import { useEffect, useRef } from "react";

type Point = {
  x: number;
  y: number;
};

type Rgb = {
  r: number;
  g: number;
  b: number;
};

type Palette = {
  background: Rgb;
  foreground: Rgb;
  primary: Rgb;
};

const DOT_STEP = 26;
const INFLUENCE_X = 300;
const INFLUENCE_Y = 150;
const TRUST_X = 235;
const TRUST_Y = 118;
const TRUST_CELL = 18;
const OFFSCREEN = -9999;
const FIELD_ANGLE = -0.22;
const PRIMARY_FALLBACK = "#0e7c7b";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

function parseRgb(value: string, fallback: Rgb): Rgb {
  const hex = value.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i);

  if (hex) {
    const raw = hex[1];
    const normalized =
      raw.length === 3
        ? raw
            .split("")
            .map(char => char + char)
            .join("")
        : raw;

    return {
      r: Number.parseInt(normalized.slice(0, 2), 16),
      g: Number.parseInt(normalized.slice(2, 4), 16),
      b: Number.parseInt(normalized.slice(4, 6), 16),
    };
  }

  const rgb = value.match(/rgba?\(([^)]+)\)/i);
  if (!rgb) return fallback;

  const channels = rgb[1]
    .replace(/\//g, " ")
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map(channel => {
      const parsed = Number.parseFloat(channel);
      return channel.endsWith("%") ? (parsed / 100) * 255 : parsed;
    });

  if (channels.length < 3 || channels.some(channel => Number.isNaN(channel))) {
    return fallback;
  }

  return {
    r: clamp(channels[0], 0, 255),
    g: clamp(channels[1], 0, 255),
    b: clamp(channels[2], 0, 255),
  };
}

function tokenRgb(name: string, fallback: string): Rgb {
  if (typeof document === "undefined") {
    return parseRgb(fallback, { r: 14, g: 124, b: 123 });
  }

  const probe = document.createElement("span");
  probe.style.color = `var(${name}, ${fallback})`;
  probe.style.position = "absolute";
  probe.style.pointerEvents = "none";
  probe.style.visibility = "hidden";
  document.body.appendChild(probe);

  const resolved = getComputedStyle(probe).color;
  probe.remove();

  return parseRgb(resolved, parseRgb(fallback, { r: 14, g: 124, b: 123 }));
}

function rgba(color: Rgb, alpha: number) {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${clamp(alpha, 0, 1)})`;
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  palette: Palette,
  dark: boolean
) {
  ctx.fillStyle = rgba(palette.background, 1);
  ctx.fillRect(0, 0, width, height);

  const membrane = ctx.createLinearGradient(0, 0, width, height);
  membrane.addColorStop(0, rgba(palette.primary, 0));
  membrane.addColorStop(0.48, rgba(palette.primary, dark ? 0.095 : 0.078));
  membrane.addColorStop(0.78, rgba(palette.primary, dark ? 0.13 : 0.11));
  membrane.addColorStop(1, rgba(palette.primary, 0));

  ctx.save();
  ctx.globalCompositeOperation = dark ? "screen" : "multiply";
  ctx.fillStyle = membrane;
  ctx.beginPath();
  ctx.moveTo(width * -0.08, height * 0.1);
  ctx.bezierCurveTo(
    width * 0.28,
    height * 0.18,
    width * 0.5,
    height * -0.04,
    width * 1.08,
    height * 0.06
  );
  ctx.lineTo(width * 1.1, height * 1.04);
  ctx.bezierCurveTo(
    width * 0.78,
    height * 0.86,
    width * 0.44,
    height * 1.08,
    width * -0.12,
    height * 0.9
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function AgenticGrid() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const maybeContext = canvas.getContext("2d", { alpha: true });
    if (!maybeContext) return;
    const ctx: CanvasRenderingContext2D = maybeContext;

    const mouse = { current: { x: OFFSCREEN, y: OFFSCREEN } };
    const smooth = { current: { x: OFFSCREEN, y: OFFSCREEN } };
    const active = { current: false };
    const intensity = { current: 0 };
    const dark = {
      current: document.documentElement.classList.contains("dark"),
    };
    const reduced = {
      current: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    };
    const size = { current: { width: 0, height: 0, dpr: 1 } };
    const palette = {
      current: {
        background: tokenRgb(
          "--background",
          dark.current ? "#0a0a0a" : "#f5f5f5"
        ),
        foreground: tokenRgb(
          "--foreground",
          dark.current ? "#f5f5f5" : "#0a0a0a"
        ),
        primary: tokenRgb("--primary", PRIMARY_FALLBACK),
      } satisfies Palette,
    };
    let raf = 0;

    const updatePalette = () => {
      dark.current = document.documentElement.classList.contains("dark");
      palette.current = {
        background: tokenRgb(
          "--background",
          dark.current ? "#0a0a0a" : "#f5f5f5"
        ),
        foreground: tokenRgb(
          "--foreground",
          dark.current ? "#f5f5f5" : "#0a0a0a"
        ),
        primary: tokenRgb("--primary", PRIMARY_FALLBACK),
      };
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = window.innerWidth;
      const height = window.innerHeight;

      size.current = { width, height, dpr };
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const isGridSurface = (event: PointerEvent) => {
      const target = document.elementFromPoint(event.clientX, event.clientY);
      return !target?.closest("[data-no-grid]");
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!isGridSurface(event)) {
        active.current = false;
        return;
      }

      active.current = true;
      mouse.current = { x: event.clientX, y: event.clientY };

      if (reduced.current) draw(performance.now());
    };

    const onPointerLeave = () => {
      active.current = false;
      mouse.current = { x: OFFSCREEN, y: OFFSCREEN };

      if (reduced.current) draw(performance.now());
    };

    function draw(now: number) {
      const { width, height, dpr } = size.current;
      if (!width || !height) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const time = now / 1000;
      const currentPalette = palette.current;
      const target = active.current ? 1 : 0;
      const easing = active.current ? 0.14 : 0.075;
      intensity.current += (target - intensity.current) * easing;

      if (smooth.current.x === OFFSCREEN && active.current) {
        smooth.current = { ...mouse.current };
      }

      if (active.current) {
        smooth.current = {
          x: smooth.current.x + (mouse.current.x - smooth.current.x) * 0.18,
          y: smooth.current.y + (mouse.current.y - smooth.current.y) * 0.18,
        };
      }

      const dir = { x: Math.cos(FIELD_ANGLE), y: Math.sin(FIELD_ANGLE) };
      const normal = { x: -dir.y, y: dir.x };

      drawBackground(ctx, width, height, currentPalette, dark.current);

      ctx.save();
      ctx.globalCompositeOperation = dark.current ? "screen" : "multiply";

      const baseAlpha = dark.current ? 0.18 : 0.2;
      const originX = -DOT_STEP;
      const originY = -DOT_STEP;

      for (let y = originY; y < height + DOT_STEP; y += DOT_STEP) {
        for (let x = originX; x < width + DOT_STEP; x += DOT_STEP) {
          const seed = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
          const jitter = seed - Math.floor(seed);
          const phase = time * (0.65 + jitter * 0.35) + jitter * Math.PI * 2;
          const baseX = x + (jitter - 0.5) * 6;
          const baseY = y + Math.sin(x * 0.018 + y * 0.011) * 2.5;
          const dx = baseX - smooth.current.x;
          const dy = baseY - smooth.current.y;
          const localX = dx * dir.x + dy * dir.y;
          const localY = dx * normal.x + dy * normal.y;
          const cursorInfluence =
            intensity.current *
            Math.exp(
              -(
                (localX / INFLUENCE_X) * (localX / INFLUENCE_X) +
                (localY / INFLUENCE_Y) * (localY / INFLUENCE_Y)
              )
            );
          const trustMetric =
            Math.pow(localX / TRUST_X, 4) + Math.pow(localY / TRUST_Y, 4);
          const trust = cursorInfluence * Math.exp(-trustMetric);
          const boundary =
            cursorInfluence * Math.exp(-Math.pow(trustMetric - 1, 2) / 0.16);
          const authorized =
            (Math.floor(baseX / DOT_STEP) * 7 +
              Math.floor(baseY / DOT_STEP) * 11 +
              Math.floor(jitter * 17)) %
              5 <
            3
              ? 1
              : 0;
          const snapX = Math.round(localX / TRUST_CELL) * TRUST_CELL;
          const snapY = Math.round(localY / TRUST_CELL) * TRUST_CELL;
          const snap = trust * authorized * 0.86;
          const filtered = trust * (1 - authorized);
          const sweepX =
            ((time * 92 + Math.floor(jitter * 160)) % (TRUST_X * 2.2)) -
            TRUST_X * 1.1;
          const sweep =
            trust *
            authorized *
            Math.exp(-Math.pow((localX - sweepX) / 26, 2)) *
            (0.45 + 0.55 * Math.sin(time * 4.4 + jitter * Math.PI * 2));
          const signedPulse =
            authorized *
            trust *
            (0.5 + 0.5 * Math.sin(time * 3.2 + snapX * 0.04 + snapY * 0.07));
          const lanePull = -localY * cursorInfluence * 0.035;
          const drift = Math.sin(phase) * 1.35;
          const stream =
            Math.sin(localX * 0.042 - time * 2.2) * cursorInfluence * 2.4;
          const sortedLocalX =
            localX +
            (snapX - localX) * snap +
            (localX / TRUST_X) * filtered * 18 -
            boundary * authorized * (localX / TRUST_X) * 6;
          const sortedLocalY =
            localY +
            (snapY - localY) * snap +
            (localY / TRUST_Y) * filtered * 13 -
            boundary * authorized * (localY / TRUST_Y) * 4;
          const dotX =
            smooth.current.x +
            dir.x * sortedLocalX +
            normal.x * sortedLocalY +
            dir.x * (drift + cursorInfluence * 2.2 + stream * 0.72) +
            normal.x * lanePull;
          const dotY =
            smooth.current.y +
            dir.y * sortedLocalX +
            normal.y * sortedLocalY +
            dir.y * (drift + cursorInfluence * 2.2 + stream * 0.72) +
            normal.y * lanePull;
          const pulse = 0.5 + Math.sin(phase + x * 0.01) * 0.5;
          const alpha =
            baseAlpha +
            pulse * (dark.current ? 0.075 : 0.085) +
            cursorInfluence * (dark.current ? 0.13 : 0.16) +
            trust * authorized * (dark.current ? 0.34 : 0.3) +
            sweep * (dark.current ? 0.4 : 0.34) -
            filtered * (dark.current ? 0.12 : 0.09) -
            boundary * (1 - authorized) * (dark.current ? 0.14 : 0.1);
          const size =
            (dark.current ? 0.85 : 1.05) +
            pulse * (dark.current ? 0.42 : 0.5) +
            cursorInfluence * (dark.current ? 0.46 : 0.58) +
            signedPulse * 0.9 +
            sweep * 1.05 -
            filtered * 0.34;

          ctx.fillStyle = rgba(currentPalette.primary, alpha);
          const drawnSize = Math.max(0.42, size);
          ctx.fillRect(
            dotX - drawnSize / 2,
            dotY - drawnSize / 2,
            drawnSize,
            drawnSize
          );
        }
      }

      ctx.restore();
    }

    const run = (now: number) => {
      draw(now);
      if (!reduced.current) {
        raf = requestAnimationFrame(run);
      }
    };

    const restartAnimation = () => {
      cancelAnimationFrame(raf);
      if (reduced.current) {
        draw(performance.now());
      } else {
        raf = requestAnimationFrame(run);
      }
    };

    const onMotionPreferenceChange = (event: MediaQueryListEvent) => {
      reduced.current = event.matches;
      restartAnimation();
    };

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const observer = new MutationObserver(() => {
      updatePalette();
      if (reduced.current) draw(performance.now());
    });

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("blur", onPointerLeave);
    motionQuery.addEventListener("change", onMotionPreferenceChange);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    restartAnimation();

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("blur", onPointerLeave);
      motionQuery.removeEventListener("change", onMotionPreferenceChange);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-background"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-background/90 to-background/0" />
      <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-background/95 to-background/0" />
      <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background/85 to-background/0" />
      <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background/85 to-background/0" />
    </div>
  );
}
