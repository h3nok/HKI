/**
 * DigitalWarehouse — HKI warehouse-inspired background.
 *
 * Perspective grid floor in brand blue/red. The grid lines themselves
 * are the interactive element: a brighter version is revealed around
 * the cursor via a radial mask, so lines "light up" in blue and red
 * as you move the mouse — like warehouse aisle lighting activating.
 *
 * Floating warehouse icons (pallets, boxes, shelving, barcodes) drift
 * and react to cursor proximity.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";

// ── Warehouse icon shapes ────────────────────────────────────────────────────

interface FloatingItem {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  delay: number;
  shape: "pallet" | "box" | "shelf" | "barcode";
}

const SPRING = { damping: 30, stiffness: 80, mass: 0.6 };

function generateItems(): FloatingItem[] {
  const shapes: FloatingItem["shape"][] = ["pallet", "box", "shelf", "barcode"];
  const items: FloatingItem[] = [];
  for (let i = 0; i < 22; i++) {
    items.push({
      id: i,
      x: 5 + Math.random() * 90,
      y: 5 + Math.random() * 90,
      size: 18 + Math.random() * 16,
      speed: 0.3 + Math.random() * 0.7,
      delay: Math.random() * 8,
      shape: shapes[i % shapes.length],
    });
  }
  return items;
}

function WarehouseShape({ shape, size, color }: { shape: FloatingItem["shape"]; size: number; color: string }) {
  switch (shape) {
    case "pallet":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.2">
          <rect x="2" y="4" width="20" height="4" rx="1" />
          <rect x="2" y="12" width="20" height="4" rx="1" />
          <line x1="6" y1="8" x2="6" y2="12" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="18" y1="8" x2="18" y2="12" />
          <line x1="4" y1="16" x2="4" y2="21" />
          <line x1="20" y1="16" x2="20" y2="21" />
        </svg>
      );
    case "box":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.2">
          <path d="M12 2 L22 7 L22 17 L12 22 L2 17 L2 7 Z" />
          <line x1="12" y1="12" x2="12" y2="22" />
          <line x1="2" y1="7" x2="12" y2="12" />
          <line x1="22" y1="7" x2="12" y2="12" />
        </svg>
      );
    case "shelf":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.2">
          <rect x="3" y="2" width="18" height="20" rx="1" />
          <line x1="3" y1="8" x2="21" y2="8" />
          <line x1="3" y1="14" x2="21" y2="14" />
          <rect x="6" y="3" width="4" height="4" rx="0.5" opacity="0.6" />
          <rect x="14" y="3" width="4" height="4" rx="0.5" opacity="0.6" />
          <rect x="6" y="9" width="5" height="4" rx="0.5" opacity="0.6" />
          <rect x="14" y="15" width="4" height="4" rx="0.5" opacity="0.6" />
        </svg>
      );
    case "barcode":
      return (
        <svg width={size} height={size * 0.6} viewBox="0 0 24 14" fill="none" stroke={color} strokeWidth="1">
          {[2, 4, 5, 7, 9, 10, 12, 14, 16, 17, 19, 21].map(x => (
            <line key={x} x1={x} y1="1" x2={x} y2="11" strokeWidth={x % 3 === 0 ? "1.5" : "0.8"} />
          ))}
          <line x1="1" y1="13" x2="23" y2="13" strokeWidth="0.5" opacity="0.4" />
        </svg>
      );
  }
}

// ── Main component ───────────────────────────────────────────────────────────

export function DigitalWarehouse() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 600], [0, 80]);
  const gridOpacity = useTransform(scrollY, [0, 500], [1, 0.25]);

  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 });
  const [items] = useState(generateItems);

  const smoothX = useSpring(0.5, SPRING);
  const smoothY = useSpring(0.5, SPRING);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const nx = e.clientX / window.innerWidth;
    const ny = e.clientY / window.innerHeight;
    setMouse({ x: nx, y: ny });
    smoothX.set(nx);
    smoothY.set(ny);
  }, [smoothX, smoothY]);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [handleMouseMove]);

  const gridRotateX = useTransform(smoothY, [0, 1], [68, 62]);
  const gridRotateY = useTransform(smoothX, [0, 1], [-2.5, 2.5]);

  const cursorMaskLeft = useTransform(smoothX, v => `${v * 100}%`);
  const cursorMaskTop = useTransform(smoothY, v => `${v * 100}%`);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-0 overflow-hidden pointer-events-none
                 bg-background"
    >
      {/* ── Ambient base ── */}
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

      {/* ── Perspective warehouse floor grid ── */}
      <motion.div
        style={{ y, opacity: gridOpacity }}
        className="absolute inset-0"
      >
        {/* ─── Base grid (always visible, dim) ─── */}
        {/* Light mode base */}
        <motion.div
          className="absolute left-[-60%] right-[-60%] top-[15%] bottom-[-80%]
                     dark:opacity-0 transition-opacity duration-500"
          style={{
            backgroundImage: `
              linear-gradient(to right, transparent 0px, rgba(0,93,170,0.06) 1px, transparent 2px),
              linear-gradient(to bottom, transparent 0px, rgba(0,93,170,0.04) 1px, transparent 2px)
            `,
            backgroundSize: "120px 120px",
            transform: useTransform(
              [gridRotateX, gridRotateY],
              ([rx, ry]) => `perspective(1200px) rotateX(${rx}deg) rotateY(${ry}deg)`,
            ),
            maskImage: "linear-gradient(to bottom, transparent 0%, black 20%, black 70%, transparent 92%)",
          }}
        />
        {/* Dark mode base */}
        <motion.div
          className="absolute left-[-60%] right-[-60%] top-[5%] bottom-[-80%]
                     dark:opacity-100 opacity-0 transition-opacity duration-500"
          style={{
            backgroundImage: `
              linear-gradient(to right, transparent 0px, rgba(0,93,170,0.32) 1px, transparent 2px),
              linear-gradient(to bottom, transparent 0px, rgba(0,93,170,0.22) 1px, transparent 2px)
            `,
            backgroundSize: "120px 120px",
            transform: useTransform(
              [gridRotateX, gridRotateY],
              ([rx, ry]) => `perspective(1200px) rotateX(${rx}deg) rotateY(${ry}deg)`,
            ),
            maskImage: "linear-gradient(to bottom, transparent 0%, black 12%, black 75%, transparent 94%)",
          }}
        />

        {/* ─── Cursor-reveal: BRIGHT blue grid — masked to cursor position ─── */}
        {/* Light mode reveal */}
        <motion.div
          className="absolute left-[-60%] right-[-60%] top-[15%] bottom-[-80%]
                     dark:opacity-0 transition-opacity duration-500"
          style={{
            backgroundImage: `
              linear-gradient(to right, transparent 0px, rgba(0,93,170,0.35) 1px, transparent 2px),
              linear-gradient(to bottom, transparent 0px, rgba(0,93,170,0.25) 1px, transparent 2px)
            `,
            backgroundSize: "120px 120px",
            transform: useTransform(
              [gridRotateX, gridRotateY],
              ([rx, ry]) => `perspective(1200px) rotateX(${rx}deg) rotateY(${ry}deg)`,
            ),
            maskImage: useTransform(
              [cursorMaskLeft, cursorMaskTop],
              ([cx, cy]) =>
                `radial-gradient(ellipse 500px 500px at ${cx} ${cy}, black 0%, transparent 70%), linear-gradient(to bottom, transparent 0%, transparent 20%, transparent 70%, transparent 92%)`,
            ),
            WebkitMaskImage: useTransform(
              [cursorMaskLeft, cursorMaskTop],
              ([cx, cy]) =>
                `radial-gradient(ellipse 500px 500px at ${cx} ${cy}, black 0%, transparent 70%)`,
            ),
          }}
        />
        {/* Dark mode reveal — blue */}
        <motion.div
          className="absolute left-[-60%] right-[-60%] top-[12%] bottom-[-80%]
                     dark:opacity-100 opacity-0 transition-opacity duration-500"
          style={{
            backgroundImage: `
              linear-gradient(to right, transparent 0px, rgba(0,93,170,0.55) 1px, transparent 2px),
              linear-gradient(to bottom, transparent 0px, rgba(0,93,170,0.4) 1px, transparent 2px)
            `,
            backgroundSize: "120px 120px",
            transform: useTransform(
              [gridRotateX, gridRotateY],
              ([rx, ry]) => `perspective(1200px) rotateX(${rx}deg) rotateY(${ry}deg)`,
            ),
            maskImage: useTransform(
              [cursorMaskLeft, cursorMaskTop],
              ([cx, cy]) =>
                `radial-gradient(ellipse 600px 600px at ${cx} ${cy}, black 0%, transparent 65%)`,
            ),
            WebkitMaskImage: useTransform(
              [cursorMaskLeft, cursorMaskTop],
              ([cx, cy]) =>
                `radial-gradient(ellipse 600px 600px at ${cx} ${cy}, black 0%, transparent 65%)`,
            ),
          }}
        />

        {/* ─── Cursor-reveal: RED accent lines — offset grid ─── */}
        {/* Light mode red reveal */}
        <motion.div
          className="absolute left-[-60%] right-[-60%] top-[15%] bottom-[-80%]
                     dark:opacity-0 transition-opacity duration-500"
          style={{
            backgroundImage: `
              linear-gradient(to right, transparent 0px, rgba(227,24,55,0.2) 1px, transparent 2px),
              linear-gradient(to bottom, transparent 0px, rgba(227,24,55,0.12) 1px, transparent 2px)
            `,
            backgroundSize: "360px 360px",
            transform: useTransform(
              [gridRotateX, gridRotateY],
              ([rx, ry]) => `perspective(1200px) rotateX(${rx}deg) rotateY(${ry}deg)`,
            ),
            maskImage: useTransform(
              [cursorMaskLeft, cursorMaskTop],
              ([cx, cy]) =>
                `radial-gradient(ellipse 400px 400px at ${cx} ${cy}, black 0%, transparent 60%)`,
            ),
            WebkitMaskImage: useTransform(
              [cursorMaskLeft, cursorMaskTop],
              ([cx, cy]) =>
                `radial-gradient(ellipse 400px 400px at ${cx} ${cy}, black 0%, transparent 60%)`,
            ),
          }}
        />
        {/* Dark mode red reveal */}
        <motion.div
          className="absolute left-[-60%] right-[-60%] top-[12%] bottom-[-80%]
                     dark:opacity-100 opacity-0 transition-opacity duration-500"
          style={{
            backgroundImage: `
              linear-gradient(to right, transparent 0px, rgba(227,24,55,0.35) 1px, transparent 2px),
              linear-gradient(to bottom, transparent 0px, rgba(227,24,55,0.2) 1px, transparent 2px)
            `,
            backgroundSize: "360px 360px",
            transform: useTransform(
              [gridRotateX, gridRotateY],
              ([rx, ry]) => `perspective(1200px) rotateX(${rx}deg) rotateY(${ry}deg)`,
            ),
            maskImage: useTransform(
              [cursorMaskLeft, cursorMaskTop],
              ([cx, cy]) =>
                `radial-gradient(ellipse 500px 500px at ${cx} ${cy}, black 0%, transparent 60%)`,
            ),
            WebkitMaskImage: useTransform(
              [cursorMaskLeft, cursorMaskTop],
              ([cx, cy]) =>
                `radial-gradient(ellipse 500px 500px at ${cx} ${cy}, black 0%, transparent 60%)`,
            ),
          }}
        />
      </motion.div>

      {/* ── Floating warehouse elements ── */}
      <div className="absolute inset-0">
        {items.map(item => {
          const dx = (mouse.x - item.x / 100) * 40 * item.speed;
          const dy = (mouse.y - item.y / 100) * 30 * item.speed;
          const dist = Math.sqrt(
            Math.pow(mouse.x - item.x / 100, 2) +
            Math.pow(mouse.y - item.y / 100, 2),
          );
          const proximity = Math.max(0, 1 - dist / 0.25);
          const isRed = item.id % 3 === 0;
          const baseOpacity = 0.08 + proximity * 0.25;

          return (
            <motion.div
              key={item.id}
              className="absolute"
              initial={{ opacity: 0 }}
              animate={{
                opacity: baseOpacity,
                x: [0, 10 * item.speed, -7 * item.speed, 0],
                y: [0, -8 * item.speed, 5 * item.speed, 0],
              }}
              transition={{
                opacity: { duration: 0.4 },
                x: { duration: 14 + item.delay * 2, repeat: Infinity, ease: "easeInOut" },
                y: { duration: 11 + item.delay * 2, repeat: Infinity, ease: "easeInOut", delay: item.delay },
              }}
              style={{
                left: `${item.x}%`,
                top: `${item.y}%`,
                transform: `translate(${-dx}px, ${-dy}px) rotate(${dx * 0.4}deg) scale(${1 + proximity * 0.3})`,
                transition: "transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.4s ease",
                filter: proximity > 0.2
                  ? `drop-shadow(0 0 ${6 + proximity * 8}px ${isRed ? "rgba(227,24,55,0.4)" : "rgba(0,93,170,0.4)"})`
                  : "none",
              }}
            >
              <WarehouseShape
                shape={item.shape}
                size={item.size}
                color={isRed ? "rgba(227,24,55,0.7)" : "rgba(0,93,170,0.6)"}
              />
            </motion.div>
          );
        })}
      </div>

      {/* ── Horizon glow ── */}
      <div
        className="absolute left-0 right-0 top-[30%] h-[2px]
                   bg-gradient-to-r from-transparent via-primary/[0.06] to-transparent
                   dark:via-primary/[0.15]"
      />

      {/* ── Edge fades ── */}
      <div className="absolute left-0 right-0 top-0 h-[22%] bg-gradient-to-b from-background via-background/70 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-[10%] bg-gradient-to-t from-background to-transparent pointer-events-none" />

      {/* Noise texture */}
      <div
        className="absolute inset-0 opacity-[0.025] dark:opacity-[0.05]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' seed='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "256px 256px",
        }}
      />
    </div>
  );
}
