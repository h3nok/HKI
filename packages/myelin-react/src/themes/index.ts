import type { NodeRole } from "@myelin/core";

// ─── Theme interface ──────────────────────────────────────────────────────────

export interface NeuralOrchestratorTheme {
  /** Three.js hex integer for the scene background */
  bg: number;
  /** Per-role node colors as Three.js hex integers */
  nodes: Record<NodeRole, number>;
  /** Edge colors: base (cold) → hot (signal traversal) */
  edges: { base: number; hot: number };
  /** Five signal particle colors, cycled in order */
  signals: readonly [number, number, number, number, number];
}

export interface PrimaryTokenThemeOptions {
  /** Single brand identity token used to derive the full visualization palette */
  primary: number;
  /** Scene background (defaults to black for agentic shell embedding) */
  bg?: number;
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function hexToRgb(hex: number): { r: number; g: number; b: number } {
  return {
    r: (hex >> 16) & 0xff,
    g: (hex >> 8) & 0xff,
    b: hex & 0xff,
  };
}

function rgbToHex(r: number, g: number, b: number): number {
  const rr = clampByte(r);
  const gg = clampByte(g);
  const bb = clampByte(b);
  return (rr << 16) | (gg << 8) | bb;
}

function blend(base: number, target: number, amount: number): number {
  const t = Math.max(0, Math.min(1, amount));
  const a = hexToRgb(base);
  const b = hexToRgb(target);
  return rgbToHex(
    a.r + (b.r - a.r) * t,
    a.g + (b.g - a.g) * t,
    a.b + (b.b - a.b) * t
  );
}

const tint = (hex: number, amount: number) => blend(hex, 0xffffff, amount);
const shade = (hex: number, amount: number) => blend(hex, 0x000000, amount);

/**
 * Derive the full Myelin palette from a single primary token.
 * This keeps Myelin visually unique while remaining aligned to host-shell branding.
 */
export function createThemeFromPrimaryToken({
  primary,
  bg = 0x000000,
}: PrimaryTokenThemeOptions): NeuralOrchestratorTheme {
  const nodes: Record<NodeRole, number> = {
    orchestrator: primary,
    agent: tint(primary, 0.18),
    tool: shade(primary, 0.16),
    persist: tint(primary, 0.34),
  };

  return {
    bg,
    nodes,
    edges: {
      base: shade(primary, 0.78),
      hot: tint(primary, 0.4),
    },
    signals: [
      tint(primary, 0.08),
      primary,
      shade(primary, 0.1),
      tint(primary, 0.24),
      tint(primary, 0.42),
    ],
  };
}

// ─── Myelin theme (default standalone preset) ────────────────────────────────
// Myelin has its own visualization identity: one primary token expanded through
// deterministic tint/shade transforms, while host apps can still override it.

export const myelinTheme: NeuralOrchestratorTheme = createThemeFromPrimaryToken(
  {
    primary: 0x38d6c7,
    bg: 0x020606,
  }
);

// ─── HKI Platform theme ──────────────────────────────────────────────────────
// Derived from a single HKI primary token (Iris 400), then expanded via
// deterministic tint/shade transforms for role and signal separation.

export const hkiTheme: NeuralOrchestratorTheme = createThemeFromPrimaryToken({
  primary: 0x1fa9a5,
});

// ─── Neural / sci-fi theme ────────────────────────────────────────────────────
// Original cyan-heavy dark palette for standalone showcase use.

export const neuralTheme: NeuralOrchestratorTheme = {
  bg: 0x03060d,
  nodes: {
    orchestrator: 0xeaf6ff,
    agent: 0x5fe8ff,
    tool: 0xffb454,
    persist: 0x5dff9b,
  },
  edges: {
    base: 0x0e2540,
    hot: 0x9fe6ff,
  },
  signals: [0x5fe8ff, 0xb07bff, 0xff5fc4, 0x5dff9b, 0xffb454],
};
