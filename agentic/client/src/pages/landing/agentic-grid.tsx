/**
 * AgenticGrid — Canvas grid background for the Agentic Platform landing.
 *
 * Subtle, agentic grid that gently responds to cursor movement:
 *   • Vertical lines  → HKI Blue   (#005DAA) near cursor
 *   • Horizontal lines → HKI Red   (#E31837) near cursor
 *   • Gentle magnetic attract — grid flows toward the cursor
 *   • Soft awareness glow & proximity dot brightening
 *   • Micro-parallax — entire grid shifts subtly with cursor position
 *   • Ambient breathing dots & wandering energy nodes
 *   • Scroll-aware opacity fade
 *
 * Single <canvas>, requestAnimationFrame, DPR-aware.
 * Respects prefers-reduced-motion.
 */

import { useRef, useEffect, useCallback } from "react";

// ── Constants ────────────────────────────────────────────────────────────────

const BLUE = "#005DAA";
const RED = "#E31837";

const CELL = 56;
// Gentle magnetic field — attracts points TOWARD cursor (not push away)
const FIELD_RADIUS = 260;
const FIELD_STRENGTH = 10; // subtle pull, was 58
const FADE_RADIUS = FIELD_RADIUS * 0.85;

// Micro-parallax — whole grid shifts subtly by cursor position
const PARALLAX_STRENGTH = 8; // max pixel offset at screen edges

// Ambient wave propagation
const WAVE_AMP = 2.8;
const WAVE_SPEED_V = 0.6;
const WAVE_SPEED_H = 0.45;
const WAVE_LENGTH = 0.035;
const WAVE_COLOR_A = 0.055;
const WAVE_COLOR_A_DARK = 0.1;

// Cursor-origin wave propagation — ripples radiate outward from cursor
const CURSOR_WAVE_SPEED = 3.5; // pixels per frame the wave front travels
const CURSOR_WAVE_AMP = 4.5; // max displacement at wavefront
const CURSOR_WAVE_DECAY = 0.0012; // how fast amplitude decays with distance
const CURSOR_WAVE_FREQ = 0.025; // spatial frequency of the ripple rings
const CURSOR_WAVE_MAX_AGE = 300; // frames before a wave is retired

const LINE_LIGHT = "rgba(0,0,0,";
const LINE_DARK = "rgba(130,155,190,";

// Wandering energy nodes
const NODE_COUNT = 5;

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  return `${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)}`;
}

const BLUE_RGB = hexToRgb(BLUE);
const RED_RGB = hexToRgb(RED);
const PURPLE_RGB = "100,40,140";
const BLUE_LINE = `rgba(${BLUE_RGB},`;
const RED_LINE = `rgba(${RED_RGB},`;

interface Pt {
  x: number;
  y: number;
}

interface CursorWave {
  ox: number; // origin x
  oy: number; // origin y
  age: number; // frames since spawn
}

interface EnergyNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rgb: string;
  phase: number;
}

/** Gentle magnetic attract — points drift inward toward cursor */
function attract(px: number, py: number, mx: number, my: number): Pt {
  const dx = px - mx;
  const dy = py - my;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > FIELD_RADIUS || dist < 1) return { x: px, y: py };
  const f = (1 - dist / FIELD_RADIUS) ** 1.8;
  // Negative sign = attract inward (toward cursor)
  return {
    x: px - (dx / dist) * FIELD_STRENGTH * f,
    y: py - (dy / dist) * FIELD_STRENGTH * f,
  };
}

function initNodes(w: number, h: number): EnergyNode[] {
  const nodes: EnergyNode[] = [];
  for (let i = 0; i < NODE_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.15 + Math.random() * 0.2;
    nodes.push({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rgb: i % 2 === 0 ? BLUE_RGB : RED_RGB,
      phase: Math.random() * Math.PI * 2,
    });
  }
  return nodes;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AgenticGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: -9999, y: -9999 });
  const smooth = useRef({ x: -9999, y: -9999 });
  const active = useRef(false);
  const intensity = useRef(0);
  const raf = useRef(0);
  const dark = useRef(false);
  const reducedMotion = useRef(false);
  const frameCount = useRef(0);
  const scrollY = useRef(0);
  const energyNodes = useRef<EnergyNode[]>([]);
  const cursorWaves = useRef<CursorWave[]>([]);
  const waveSpawnCounter = useRef(0);

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

    // Initialize energy nodes on first frame
    if (energyNodes.current.length === 0) {
      energyNodes.current = initNodes(w, h);
    }

    frameCount.current++;
    const reduced = reducedMotion.current;
    const s = smooth.current;
    const m = mouse.current;

    if (reduced) {
      s.x = m.x;
      s.y = m.y;
      intensity.current = active.current ? 1 : 0;
    } else {
      const target = active.current ? 1 : 0;
      intensity.current += (target - intensity.current) * 0.07;
      s.x += (m.x - s.x) * 0.09;
      s.y += (m.y - s.y) * 0.09;
    }
    const int = intensity.current;

    // Scroll fade — grid dims as user scrolls down
    const scrollFade = Math.max(0.15, 1 - scrollY.current / 800);

    ctx.clearRect(0, 0, w, h);

    const mx = s.x;
    const my = s.y;
    const hov = int > 0.005;
    const isDark = dark.current;
    const baseColor = isDark ? LINE_DARK : LINE_LIGHT;
    const baseAlpha = (isDark ? 0.1 : 0.042) * scrollFade;

    // Micro-parallax — whole grid shifts subtly based on cursor position
    const parallaxX = hov ? (mx / w - 0.5) * PARALLAX_STRENGTH * int : 0;
    const parallaxY = hov ? (my / h - 0.5) * PARALLAX_STRENGTH * int : 0;

    // ── Cursor wave spawner — periodically emit ripple rings from cursor ──
    if (hov && !reduced) {
      waveSpawnCounter.current++;
      // Spawn a new wave ring every ~18 frames (~0.3s at 60fps)
      if (waveSpawnCounter.current % 18 === 0) {
        cursorWaves.current.push({ ox: mx, oy: my, age: 0 });
      }
    }
    // Age and cull waves
    for (let wi = cursorWaves.current.length - 1; wi >= 0; wi--) {
      cursorWaves.current[wi].age++;
      if (cursorWaves.current[wi].age > CURSOR_WAVE_MAX_AGE) {
        cursorWaves.current.splice(wi, 1);
      }
    }

    const cols = Math.ceil(w / CELL) + 2;
    const rows = Math.ceil(h / CELL) + 2;
    const time = frameCount.current * 0.02;

    // ── Ambient breathing dots (visible even without hover) ───────────────
    if (!reduced) {
      const breathCycle = time * 0.4;
      for (let c = 1; c < cols; c++) {
        for (let r = 1; r < rows; r++) {
          // Only render a sparse subset for performance
          const hash = (c * 7 + r * 13) % 17;
          if (hash > 4) continue;

          const bx = c * CELL;
          const by = r * CELL;
          const phase = c * 0.37 + r * 0.53 + hash * 1.1;
          const breath = Math.sin(breathCycle + phase) * 0.5 + 0.5;
          const size = 0.6 + breath * 1.0;
          const a = (isDark ? 0.08 : 0.04) * (0.3 + breath * 0.7) * scrollFade;
          const rgb = hash % 2 === 0 ? BLUE_RGB : RED_RGB;

          ctx.beginPath();
          ctx.arc(bx, by, size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${rgb},${a})`;
          ctx.fill();

          // Soft glow halo on brightest ones
          if (breath > 0.75) {
            ctx.beginPath();
            ctx.arc(bx, by, size * 4, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${rgb},${a * 0.25})`;
            ctx.fill();
          }
        }
      }
    }

    // ── Wandering energy nodes (autonomous, always active) ─────────────────
    if (!reduced) {
      for (const node of energyNodes.current) {
        // Drift along grid lines with gentle sine wobble
        node.x += node.vx + Math.sin(time * 0.6 + node.phase) * 0.08;
        node.y += node.vy + Math.cos(time * 0.5 + node.phase) * 0.08;

        // Wrap around edges
        if (node.x < -20) node.x = w + 20;
        if (node.x > w + 20) node.x = -20;
        if (node.y < -20) node.y = h + 20;
        if (node.y > h + 20) node.y = -20;

        // Flee from cursor
        if (hov) {
          const dx = node.x - mx;
          const dy = node.y - my;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 180 && dist > 1) {
            const flee = (1 - dist / 180) * 1.2;
            node.x += (dx / dist) * flee;
            node.y += (dy / dist) * flee;
          }
        }

        const nodePulse = 0.6 + 0.4 * Math.sin(time * 2.5 + node.phase);
        const nodeA = (isDark ? 0.18 : 0.1) * nodePulse * scrollFade;
        const nodeSize = 2.0 + nodePulse * 1.5;

        // Outer glow
        const glowGrad = ctx.createRadialGradient(
          node.x,
          node.y,
          0,
          node.x,
          node.y,
          nodeSize * 6
        );
        glowGrad.addColorStop(0, `rgba(${node.rgb},${nodeA * 0.5})`);
        glowGrad.addColorStop(1, `rgba(${node.rgb},0)`);
        ctx.fillStyle = glowGrad;
        ctx.fillRect(
          node.x - nodeSize * 6,
          node.y - nodeSize * 6,
          nodeSize * 12,
          nodeSize * 12
        );

        // Core dot
        ctx.beginPath();
        ctx.arc(node.x, node.y, nodeSize, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${node.rgb},${nodeA * 2})`;
        ctx.fill();
      }

      // Draw faint connections between nearby nodes
      for (let i = 0; i < energyNodes.current.length; i++) {
        for (let j = i + 1; j < energyNodes.current.length; j++) {
          const a = energyNodes.current[i];
          const b = energyNodes.current[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 200) {
            const lineA =
              (1 - dist / 200) * (isDark ? 0.06 : 0.03) * scrollFade;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(${PURPLE_RGB},${lineA})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
    }

    // ── Soft awareness glow — single gentle radial near cursor ────────────
    if (hov) {
      const glowGrad = ctx.createRadialGradient(
        mx,
        my,
        0,
        mx,
        my,
        FIELD_RADIUS * 0.9
      );
      const glowA = int * (isDark ? 0.06 : 0.035);
      glowGrad.addColorStop(0, `rgba(${BLUE_RGB},${glowA})`);
      glowGrad.addColorStop(0.5, `rgba(${PURPLE_RGB},${glowA * 0.3})`);
      glowGrad.addColorStop(1, `rgba(${BLUE_RGB},0)`);
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, w, h);
    }

    // Precompute nearest grid lines for crosshair
    const nearBx = hov ? Math.round(mx / CELL) * CELL : -1;
    const nearBy = hov ? Math.round(my / CELL) * CELL : -1;

    // Color only appears when gravity exceeds this threshold — prevents hard edge jump
    const COLOR_THRESHOLD = 0.12;

    // ── Vertical lines: BLUE color near cursor + gentle attract + parallax ─
    for (let c = 0; c <= cols; c++) {
      const bx = c * CELL;
      const isNearest = hov && bx === nearBx;

      const colWavePhase = c * 0.45;

      ctx.beginPath();
      for (let r = 0; r <= rows; r++) {
        const by = r * CELL;
        // Ambient wave
        const waveDisp = reduced
          ? 0
          : Math.sin(by * WAVE_LENGTH - time * WAVE_SPEED_V + colWavePhase) *
            WAVE_AMP *
            scrollFade;

        // Cursor-origin wave displacement (radial ripples from cursor)
        let cursorDisp = 0;
        if (!reduced) {
          for (const cw of cursorWaves.current) {
            const dx = bx - cw.ox;
            const dy = by - cw.oy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const waveFront = cw.age * CURSOR_WAVE_SPEED;
            const delta = dist - waveFront;
            // Only displace near the wavefront
            if (Math.abs(delta) < 80) {
              const envelope =
                Math.exp(-delta * delta * 0.002) *
                Math.exp(-dist * CURSOR_WAVE_DECAY) *
                Math.max(0, 1 - cw.age / CURSOR_WAVE_MAX_AGE);
              cursorDisp +=
                Math.sin(dist * CURSOR_WAVE_FREQ * Math.PI * 2) *
                CURSOR_WAVE_AMP *
                envelope *
                scrollFade;
            }
          }
        }

        let px = bx + waveDisp + cursorDisp + parallaxX;
        let py = by + parallaxY;
        if (hov) {
          const pulled = attract(px, py, mx, my);
          px = pulled.x;
          py = pulled.y;
        }
        if (r === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }

      // Wave intensity for this column: how "cresty" it is right now
      const colWaveInt = reduced
        ? 0
        : (Math.sin(bx * WAVE_LENGTH * 0.5 - time * WAVE_SPEED_V * 0.7 + 1.3) *
            0.5 +
            0.5) *
          scrollFade;

      let alpha = baseAlpha;
      let lw = 1;

      if (hov) {
        const dist = Math.abs(bx - mx);
        if (dist < FADE_RADIUS) {
          const gravity = Math.pow(1 - dist / FADE_RADIUS, 1.25) * int;
          const colorRamp = Math.max(
            0,
            (gravity - COLOR_THRESHOLD) / (1 - COLOR_THRESHOLD)
          );
          const accentAlpha = (isDark ? 0.46 : 0.3) * gravity;
          lw = 1 + gravity * 0.7;
          if (colorRamp > 0) {
            alpha = baseAlpha * (1 - colorRamp) + accentAlpha;
            ctx.strokeStyle = `${BLUE_LINE}${alpha})`;
          } else {
            alpha = baseAlpha + baseAlpha * gravity * 1.5;
            ctx.strokeStyle = `${baseColor}${alpha})`;
          }
          ctx.lineWidth = isNearest ? lw + 0.45 : lw;
          ctx.stroke();
          continue;
        }
      }

      // Ambient blue tint on wave crests (always, even without hover)
      if (!reduced && colWaveInt > 0.35) {
        const waveColor =
          (colWaveInt - 0.35) *
          (isDark ? WAVE_COLOR_A_DARK : WAVE_COLOR_A) *
          1.5;
        alpha = baseAlpha + waveColor;
        ctx.strokeStyle = `${BLUE_LINE}${alpha})`;
        ctx.lineWidth = 1 + colWaveInt * 0.3;
      } else {
        ctx.strokeStyle = `${baseColor}${alpha})`;
        ctx.lineWidth = 1;
      }
      ctx.stroke();
    }

    // ── Horizontal lines: RED color near cursor + gentle attract + parallax
    for (let r = 0; r <= rows; r++) {
      const by = r * CELL;
      const isNearest = hov && by === nearBy;

      const rowWavePhase = r * 0.4;

      ctx.beginPath();
      for (let c = 0; c <= cols; c++) {
        const bx = c * CELL;
        // Ambient wave
        const waveDisp = reduced
          ? 0
          : Math.sin(bx * WAVE_LENGTH - time * WAVE_SPEED_H + rowWavePhase) *
            WAVE_AMP *
            scrollFade;

        // Cursor-origin wave displacement (radial ripples from cursor)
        let cursorDisp = 0;
        if (!reduced) {
          for (const cw of cursorWaves.current) {
            const dx = bx - cw.ox;
            const dy = by - cw.oy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const waveFront = cw.age * CURSOR_WAVE_SPEED;
            const delta = dist - waveFront;
            if (Math.abs(delta) < 80) {
              const envelope =
                Math.exp(-delta * delta * 0.002) *
                Math.exp(-dist * CURSOR_WAVE_DECAY) *
                Math.max(0, 1 - cw.age / CURSOR_WAVE_MAX_AGE);
              cursorDisp +=
                Math.sin(dist * CURSOR_WAVE_FREQ * Math.PI * 2) *
                CURSOR_WAVE_AMP *
                envelope *
                scrollFade;
            }
          }
        }

        let px = bx + parallaxX;
        let py = by + waveDisp + cursorDisp + parallaxY;
        if (hov) {
          const pulled = attract(px, py, mx, my);
          px = pulled.x;
          py = pulled.y;
        }
        if (c === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }

      // Wave intensity for this row
      const rowWaveInt = reduced
        ? 0
        : (Math.sin(by * WAVE_LENGTH * 0.5 - time * WAVE_SPEED_H * 0.7 + 2.1) *
            0.5 +
            0.5) *
          scrollFade;

      let alpha = baseAlpha;
      let lw = 1;

      if (hov) {
        const dist = Math.abs(by - my);
        if (dist < FADE_RADIUS) {
          const gravity = Math.pow(1 - dist / FADE_RADIUS, 1.25) * int;
          const colorRamp = Math.max(
            0,
            (gravity - COLOR_THRESHOLD) / (1 - COLOR_THRESHOLD)
          );
          const accentAlpha = (isDark ? 0.37 : 0.23) * gravity;
          lw = 1 + gravity * 0.6;
          if (colorRamp > 0) {
            alpha = baseAlpha * (1 - colorRamp) + accentAlpha;
            ctx.strokeStyle = `${RED_LINE}${alpha})`;
          } else {
            alpha = baseAlpha + baseAlpha * gravity * 1.5;
            ctx.strokeStyle = `${baseColor}${alpha})`;
          }
          ctx.lineWidth = isNearest ? lw + 0.45 : lw;
          ctx.stroke();
          continue;
        }
      }

      // Ambient red tint on wave crests (always, even without hover)
      if (!reduced && rowWaveInt > 0.35) {
        const waveColor =
          (rowWaveInt - 0.35) *
          (isDark ? WAVE_COLOR_A_DARK : WAVE_COLOR_A) *
          1.5;
        alpha = baseAlpha + waveColor;
        ctx.strokeStyle = `${RED_LINE}${alpha})`;
        ctx.lineWidth = 1 + rowWaveInt * 0.3;
      } else {
        ctx.strokeStyle = `${baseColor}${alpha})`;
        ctx.lineWidth = 1;
      }
      ctx.stroke();
    }

    // ── Proximity brightening — dots near cursor subtly glow ─────────────
    if (hov) {
      const dotRadius = FIELD_RADIUS * 0.75;
      for (let c = 0; c <= cols; c++) {
        for (let r = 0; r <= rows; r++) {
          const bx = c * CELL + parallaxX;
          const by = r * CELL + parallaxY;
          const dist = Math.sqrt((bx - mx) ** 2 + (by - my) ** 2);
          if (dist < dotRadius) {
            const p = attract(bx, by, mx, my);
            const prox = (1 - dist / dotRadius) * int;
            const dotSize = 0.5 + prox * 1.5;
            const dotAlpha = prox ** 1.6 * (isDark ? 0.45 : 0.3);

            // Alternate blue/red by checkerboard position
            const dotRgb = (c + r) % 2 === 0 ? BLUE_RGB : RED_RGB;

            ctx.beginPath();
            ctx.arc(p.x, p.y, dotSize, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${dotRgb},${dotAlpha})`;
            ctx.fill();
          }
        }
      }
    }

    raf.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;

    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotion.current = mq.matches;
    const onMqChange = () => {
      reducedMotion.current = mq.matches;
    };
    mq.addEventListener("change", onMqChange);

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
      // Disable interaction when cursor is over foreground content
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (el?.closest("[data-no-grid]")) {
        if (active.current) {
          active.current = false;
          mouse.current = { x: -9999, y: -9999 };
        }
        return;
      }
      const r = cvs.getBoundingClientRect();
      mouse.current = { x: e.clientX - r.left, y: e.clientY - r.top };
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
      mq.removeEventListener("change", onMqChange);
    };
  }, [draw]);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-background">
      {/* Ambient base — light mode */}
      <div
        className="absolute inset-0 dark:opacity-0 transition-opacity duration-500"
        style={{
          background: `
            radial-gradient(ellipse 80% 40% at 50% 0%, rgba(0,93,170,0.05) 0%, transparent 50%),
            radial-gradient(ellipse 60% 30% at 20% 10%, rgba(227,24,55,0.02) 0%, transparent 50%),
            linear-gradient(180deg, #f7f8fa 0%, #eff1f3 100%)
          `,
        }}
      />
      {/* Ambient base — dark mode */}
      <div
        className="absolute inset-0 dark:opacity-100 opacity-0 transition-opacity duration-500"
        style={{
          background: `
            radial-gradient(ellipse 80% 45% at 50% 0%, rgba(0,93,170,0.12) 0%, transparent 55%),
            radial-gradient(ellipse 60% 35% at 80% 20%, rgba(227,24,55,0.05) 0%, transparent 50%),
            linear-gradient(180deg, #080a0f 0%, #0c0f16 40%, #080a0f 100%)
          `,
        }}
      />

      {/* Canvas grid */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        aria-hidden="true"
      />

      {/* Top edge fade */}
      <div className="absolute left-0 right-0 top-0 h-[18%] bg-gradient-to-b from-background via-background/60 to-transparent pointer-events-none" />
      {/* Bottom edge fade */}
      <div className="absolute bottom-0 left-0 right-0 h-[10%] bg-gradient-to-t from-background to-transparent pointer-events-none" />

      {/* Noise texture */}
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
