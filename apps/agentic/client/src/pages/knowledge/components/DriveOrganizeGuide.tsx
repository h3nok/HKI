/**
 * AgentSuccessGuide — 5-step visual playbook
 *
 * Core thesis: agent quality = knowledge quality.
 * Each step leads with a visual illustration, then short focused copy.
 * Steps 6–8 (team, deploy, ops) condensed: ownership folds into Step 5,
 * deployment and ops guidance surfaces at the attestation screen.
 *
 * Acceptance is persisted via tRPC, keyed by valueStreamId.
 */

import { useState, type ReactElement } from "react";
import { trpc } from "@/lib/trpc";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Lightbulb,
  ChevronRight,
  BadgeCheck,
  Lock,
} from "lucide-react";
import { cn } from "@hki/ui";
import { k } from "../theme";
import { KBEmojiBadge, type KBHKIEmojiKey } from "./kb-primitives";

// ── Step color tokens (full strings required for Tailwind JIT) ────────────────

const STEP_COLOR: Record<
  string,
  { text: string; bg: string; bar: string; border: string; chevron: string }
> = {
  blue: {
    text: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10",
    bar: "bg-blue-500",
    border: "border-l-blue-500",
    chevron: "text-blue-500",
  },
  violet: {
    text: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-500/10",
    bar: "bg-violet-500",
    border: "border-l-violet-500",
    chevron: "text-violet-500",
  },
  amber: {
    text: "text-primary",
    bg: "bg-primary/10",
    bar: "bg-primary/80",
    border: "border-l-primary",
    chevron: "text-primary",
  },
  orange: {
    text: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-500/10",
    bar: "bg-rose-500",
    border: "border-l-rose-500",
    chevron: "text-rose-500",
  },
};

// ── Inline SVG illustrations ──────────────────────────────────────────────────
// Each illustration tells the visual story of its step at a glance.

function IllustrationDecide({ className }: { className?: string }) {
  // Story: User questions → identify gaps → source documents
  const questionNodes = [
    { cx: 54, cy: 30 },
    { cx: 32, cy: 74 },
    { cx: 54, cy: 118 },
    { cx: 96, cy: 18 },
    { cx: 96, cy: 130 },
  ];
  const docShapes = [
    { x: 194, y: 14, lineWidths: [56, 76, 48, 64] },
    { x: 202, y: 54, lineWidths: [68, 52, 80, 44] },
    { x: 194, y: 96, lineWidths: [52, 72, 56, 60] },
  ];

  return (
    <svg
      viewBox="0 0 320 148"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Radial search rings */}
      <circle
        cx="160"
        cy="74"
        r="62"
        stroke="#3B82F6"
        strokeOpacity="0.05"
        strokeWidth="1.5"
      />
      <circle
        cx="160"
        cy="74"
        r="42"
        stroke="#3B82F6"
        strokeOpacity="0.08"
        strokeWidth="1.5"
      />
      <circle
        cx="160"
        cy="74"
        r="22"
        stroke="#3B82F6"
        strokeOpacity="0.13"
        strokeWidth="1.5"
      />
      {/* Central knowledge node */}
      <circle
        cx="160"
        cy="74"
        r="13"
        fill="#3B82F6"
        fillOpacity="0.14"
        stroke="#3B82F6"
        strokeOpacity="0.45"
        strokeWidth="1.5"
      />
      <circle cx="160" cy="74" r="5" fill="#3B82F6" fillOpacity="0.65" />
      {/* Question nodes with connector lines */}
      {questionNodes.map(({ cx, cy }, i) => (
        <g key={i}>
          <line
            x1={cx + 10}
            y1={cy}
            x2={147}
            y2={74}
            stroke="#3B82F6"
            strokeOpacity="0.1"
            strokeWidth="1"
            strokeDasharray="4 3"
          />
          <circle
            cx={cx}
            cy={cy}
            r="11"
            fill="#3B82F6"
            fillOpacity="0.07"
            stroke="#3B82F6"
            strokeOpacity="0.18"
            strokeWidth="1.5"
          />
          <circle cx={cx} cy={cy} r="4" fill="#3B82F6" fillOpacity="0.35" />
        </g>
      ))}
      {/* Document shapes with connector lines */}
      {docShapes.map(({ x, y, lineWidths }, i) => (
        <g key={i}>
          <line
            x1={173}
            y1={74}
            x2={x}
            y2={y + 19}
            stroke="#3B82F6"
            strokeOpacity="0.1"
            strokeWidth="1"
            strokeDasharray="4 3"
          />
          <rect
            x={x}
            y={y}
            width={106}
            height={38}
            rx="4"
            fill="#3B82F6"
            fillOpacity={i === 1 ? 0.1 : 0.06}
            stroke="#3B82F6"
            strokeOpacity={i === 1 ? 0.38 : 0.16}
            strokeWidth="1.5"
          />
          {/* Dog-ear */}
          <path
            d={`M ${x + 94} ${y} L ${x + 106} ${y + 12} L ${x + 94} ${y + 12} Z`}
            fill="#3B82F6"
            fillOpacity="0.15"
          />
          {lineWidths.map((lw, j) => (
            <rect
              key={j}
              x={x + 8}
              y={y + 7 + j * 7}
              width={lw}
              height="2.5"
              rx="1.25"
              fill="#3B82F6"
              fillOpacity={[0.3, 0.18, 0.13, 0.1][j]}
            />
          ))}
        </g>
      ))}
    </svg>
  );
}

function IllustrationQuality({ className }: { className?: string }) {
  // Story: 3 clean documents (left, green) vs scattered pile (right, amber)
  const messyDocs = [
    { x: 180, y: 22, w: 74, h: 28, rot: -7 },
    { x: 192, y: 32, w: 68, h: 26, rot: 5 },
    { x: 198, y: 14, w: 72, h: 26, rot: -3 },
    { x: 177, y: 56, w: 70, h: 26, rot: 8 },
    { x: 190, y: 62, w: 74, h: 26, rot: -5 },
    { x: 200, y: 46, w: 68, h: 26, rot: 3 },
    { x: 180, y: 88, w: 72, h: 26, rot: -4 },
    { x: 193, y: 96, w: 66, h: 26, rot: 7 },
    { x: 202, y: 78, w: 70, h: 26, rot: -2 },
    { x: 183, y: 112, w: 68, h: 26, rot: 5 },
    { x: 196, y: 118, w: 72, h: 26, rot: -6 },
  ];

  return (
    <svg
      viewBox="0 0 320 148"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Center divider */}
      <line
        x1="160"
        y1="8"
        x2="160"
        y2="140"
        stroke="#E2E8F0"
        strokeWidth="1.5"
        strokeDasharray="5 4"
      />

      {/* LEFT — quality: neat stacked docs */}
      <rect
        x="36"
        y="76"
        width="92"
        height="38"
        rx="4"
        fill="#10B981"
        fillOpacity="0.04"
        stroke="#10B981"
        strokeOpacity="0.1"
        strokeWidth="1"
      />
      <rect
        x="40"
        y="62"
        width="92"
        height="38"
        rx="4"
        fill="#10B981"
        fillOpacity="0.06"
        stroke="#10B981"
        strokeOpacity="0.14"
        strokeWidth="1.2"
      />
      {/* Top doc */}
      <rect
        x="44"
        y="48"
        width="92"
        height="48"
        rx="5"
        fill="#10B981"
        fillOpacity="0.1"
        stroke="#10B981"
        strokeOpacity="0.4"
        strokeWidth="1.5"
      />
      <path d="M 124 48 L 136 60 L 124 60 Z" fill="#10B981" fillOpacity="0.2" />
      <rect
        x="52"
        y="58"
        width="56"
        height="3"
        rx="1.5"
        fill="#10B981"
        fillOpacity="0.4"
      />
      <rect
        x="52"
        y="66"
        width="74"
        height="2.5"
        rx="1.25"
        fill="#10B981"
        fillOpacity="0.25"
      />
      <rect
        x="52"
        y="73"
        width="60"
        height="2.5"
        rx="1.25"
        fill="#10B981"
        fillOpacity="0.18"
      />
      <rect
        x="52"
        y="80"
        width="68"
        height="2.5"
        rx="1.25"
        fill="#10B981"
        fillOpacity="0.13"
      />
      {/* Green check badge */}
      <circle
        cx="90"
        cy="24"
        r="16"
        fill="#10B981"
        fillOpacity="0.12"
        stroke="#10B981"
        strokeOpacity="0.3"
        strokeWidth="1.5"
      />
      <path
        d="M 81 24 L 87 31 L 99 17"
        stroke="#10B981"
        strokeOpacity="0.65"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* RIGHT — quantity: overlapping scattered docs */}
      {messyDocs.map(({ x, y, w, h, rot }, i) => (
        <rect
          key={i}
          x={x}
          y={y}
          width={w}
          height={h}
          rx="3"
          fill="#0E7C7B"
          fillOpacity={0.04 + i * 0.003}
          stroke="#0E7C7B"
          strokeOpacity={0.1 + i * 0.015}
          strokeWidth="1.2"
          transform={`rotate(${rot}, ${x + w / 2}, ${y + h / 2})`}
        />
      ))}
      {/* Red X badge */}
      <circle
        cx="238"
        cy="126"
        r="14"
        fill="#EF4444"
        fillOpacity="0.1"
        stroke="#EF4444"
        strokeOpacity="0.22"
        strokeWidth="1.5"
      />
      <path
        d="M 230 118 L 246 134 M 246 118 L 230 134"
        stroke="#EF4444"
        strokeOpacity="0.45"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IllustrationOrganize({ className }: { className?: string }) {
  // Story: Topic-based folder tree — Guides / Policies / FAQs / Training
  const branches = [
    { x: 42, color: "#3B82F6" }, // Guides
    { x: 104, color: "#8B5CF6" }, // Policies
    { x: 168, color: "#0E7C7B" }, // FAQs
    { x: 232, color: "#10B981" }, // Training
  ];
  const lineWidthSets = [
    [36, 28, 32, 22],
    [40, 34, 26, 36],
    [30, 38, 28, 32],
    [38, 28, 34, 24],
  ];

  return (
    <svg
      viewBox="0 0 320 148"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Root folder */}
      <rect
        x="108"
        y="8"
        width="104"
        height="40"
        rx="6"
        fill="#8B5CF6"
        fillOpacity="0.1"
        stroke="#8B5CF6"
        strokeOpacity="0.38"
        strokeWidth="1.5"
      />
      <path
        d="M 108 8 Q 108 4 112 4 L 140 4 Q 144 4 144 8"
        stroke="#8B5CF6"
        strokeOpacity="0.28"
        strokeWidth="1.5"
        fill="#8B5CF6"
        fillOpacity="0.07"
      />
      <rect
        x="118"
        y="18"
        width="54"
        height="3"
        rx="1.5"
        fill="#8B5CF6"
        fillOpacity="0.32"
      />
      <rect
        x="118"
        y="25"
        width="40"
        height="2.5"
        rx="1.25"
        fill="#8B5CF6"
        fillOpacity="0.2"
      />
      <rect
        x="118"
        y="31"
        width="48"
        height="2.5"
        rx="1.25"
        fill="#8B5CF6"
        fillOpacity="0.15"
      />
      {/* Trunk */}
      <line
        x1="160"
        y1="48"
        x2="160"
        y2="66"
        stroke="#8B5CF6"
        strokeOpacity="0.18"
        strokeWidth="1.5"
      />
      {/* Horizontal branch rail */}
      <line
        x1="60"
        y1="66"
        x2="260"
        y2="66"
        stroke="#8B5CF6"
        strokeOpacity="0.14"
        strokeWidth="1.5"
      />
      {/* Vertical drops */}
      {branches.map(({ x, color }, i) => (
        <line
          key={i}
          x1={x + 29}
          y1="66"
          x2={x + 29}
          y2="86"
          stroke={color}
          strokeOpacity="0.2"
          strokeWidth="1.5"
        />
      ))}
      {/* Sub-folders */}
      {branches.map(({ x, color }, i) => (
        <g key={i}>
          <rect
            x={x}
            y="86"
            width="58"
            height="52"
            rx="5"
            fill={color}
            fillOpacity="0.08"
            stroke={color}
            strokeOpacity="0.3"
            strokeWidth="1.5"
          />
          <path
            d={`M ${x} 86 Q ${x} 82 ${x + 4} 82 L ${x + 20} 82 Q ${x + 24} 82 ${x + 24} 86`}
            stroke={color}
            strokeOpacity="0.18"
            strokeWidth="1.2"
            fill={color}
            fillOpacity="0.06"
          />
          {lineWidthSets[i].map((lw, j) => (
            <rect
              key={j}
              x={x + 6}
              y={98 + j * 8}
              width={lw}
              height="2.5"
              rx="1.25"
              fill={color}
              fillOpacity={[0.3, 0.2, 0.15, 0.1][j]}
            />
          ))}
          <circle
            cx={x + 50}
            cy="93"
            r="5"
            fill={color}
            fillOpacity="0.22"
            stroke={color}
            strokeOpacity="0.38"
            strokeWidth="1"
          />
        </g>
      ))}
    </svg>
  );
}

function IllustrationTest({ className }: { className?: string }) {
  // Story: Circular feedback loop — Question → Agent → Verify → Fix → repeat
  return (
    <svg
      viewBox="0 0 320 148"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <marker
          id="loopArrow"
          viewBox="0 0 8 8"
          refX="7"
          refY="4"
          markerWidth="5"
          markerHeight="5"
          orient="auto"
        >
          <path d="M 0 0 L 8 4 L 0 8 Z" fill="#94A3B8" fillOpacity="0.45" />
        </marker>
      </defs>
      {/* Background loop oval */}
      <ellipse
        cx="160"
        cy="74"
        rx="98"
        ry="48"
        stroke="#0E7C7B"
        strokeOpacity="0.06"
        strokeWidth="18"
        fill="none"
      />
      {/* Connector arrows */}
      <path
        d="M 113 38 L 207 38"
        stroke="#94A3B8"
        strokeOpacity="0.28"
        strokeWidth="1.5"
        markerEnd="url(#loopArrow)"
      />
      <path
        d="M 229 60 L 229 88"
        stroke="#94A3B8"
        strokeOpacity="0.28"
        strokeWidth="1.5"
        markerEnd="url(#loopArrow)"
      />
      <path
        d="M 207 110 L 113 110"
        stroke="#94A3B8"
        strokeOpacity="0.28"
        strokeWidth="1.5"
        markerEnd="url(#loopArrow)"
      />
      <path
        d="M 91 88 L 91 60"
        stroke="#94A3B8"
        strokeOpacity="0.28"
        strokeWidth="1.5"
        markerEnd="url(#loopArrow)"
      />
      {/* Step labels */}
      <text
        x="160"
        y="32"
        textAnchor="middle"
        fontSize="8"
        fill="#94A3B8"
        fontFamily="system-ui, sans-serif"
        fontWeight="600"
      >
        ask
      </text>
      <text
        x="248"
        y="77"
        textAnchor="start"
        fontSize="8"
        fill="#94A3B8"
        fontFamily="system-ui, sans-serif"
        fontWeight="600"
      >
        check
      </text>
      <text
        x="160"
        y="126"
        textAnchor="middle"
        fontSize="8"
        fill="#94A3B8"
        fontFamily="system-ui, sans-serif"
        fontWeight="600"
      >
        improve
      </text>
      <text
        x="72"
        y="77"
        textAnchor="end"
        fontSize="8"
        fill="#94A3B8"
        fontFamily="system-ui, sans-serif"
        fontWeight="600"
      >
        fix
      </text>
      {/* NODE 1 — Question (top-left, blue) */}
      <circle
        cx="91"
        cy="38"
        r="22"
        fill="#3B82F6"
        fillOpacity="0.08"
        stroke="#3B82F6"
        strokeOpacity="0.28"
        strokeWidth="1.5"
      />
      <path
        d="M 85 33 Q 85 27 91 27 Q 97 27 97 33 Q 97 38 91 39"
        stroke="#3B82F6"
        strokeOpacity="0.45"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="91" cy="44" r="2.2" fill="#3B82F6" fillOpacity="0.5" />
      {/* NODE 2 — Agent (top-right, violet) */}
      <circle
        cx="229"
        cy="38"
        r="22"
        fill="#8B5CF6"
        fillOpacity="0.08"
        stroke="#8B5CF6"
        strokeOpacity="0.28"
        strokeWidth="1.5"
      />
      <rect
        x="220"
        y="29"
        width="18"
        height="14"
        rx="3"
        fill="#8B5CF6"
        fillOpacity="0.15"
        stroke="#8B5CF6"
        strokeOpacity="0.28"
        strokeWidth="1.2"
      />
      <circle cx="225" cy="34" r="2" fill="#8B5CF6" fillOpacity="0.5" />
      <circle cx="233" cy="34" r="2" fill="#8B5CF6" fillOpacity="0.5" />
      <path
        d="M 224 40 Q 229 42.5 234 40"
        stroke="#8B5CF6"
        strokeOpacity="0.4"
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
      />
      <line
        x1="229"
        y1="29"
        x2="229"
        y2="23"
        stroke="#8B5CF6"
        strokeOpacity="0.28"
        strokeWidth="1.2"
      />
      <circle cx="229" cy="21" r="2.5" fill="#8B5CF6" fillOpacity="0.28" />
      {/* NODE 3 — Verify (bottom-right, green) */}
      <circle
        cx="229"
        cy="110"
        r="22"
        fill="#10B981"
        fillOpacity="0.08"
        stroke="#10B981"
        strokeOpacity="0.28"
        strokeWidth="1.5"
      />
      <path
        d="M 220 110 L 226 117 L 238 101"
        stroke="#10B981"
        strokeOpacity="0.5"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* NODE 4 — Source doc (bottom-left, amber) */}
      <circle
        cx="91"
        cy="110"
        r="22"
        fill="#0E7C7B"
        fillOpacity="0.08"
        stroke="#0E7C7B"
        strokeOpacity="0.28"
        strokeWidth="1.5"
      />
      <rect
        x="82"
        y="98"
        width="18"
        height="24"
        rx="2"
        fill="#0E7C7B"
        fillOpacity="0.14"
        stroke="#0E7C7B"
        strokeOpacity="0.32"
        strokeWidth="1.2"
      />
      <path d="M 94 98 L 100 104 L 94 104 Z" fill="#0E7C7B" fillOpacity="0.2" />
      <rect
        x="84"
        y="108"
        width="10"
        height="1.8"
        rx="0.9"
        fill="#0E7C7B"
        fillOpacity="0.4"
      />
      <rect
        x="84"
        y="112"
        width="14"
        height="1.8"
        rx="0.9"
        fill="#0E7C7B"
        fillOpacity="0.3"
      />
      <rect
        x="84"
        y="116"
        width="9"
        height="1.8"
        rx="0.9"
        fill="#0E7C7B"
        fillOpacity="0.2"
      />
    </svg>
  );
}

function IllustrationFresh({ className }: { className?: string }) {
  // Story: Content freshness degrades month over month; refresh cycle keeps it green
  const bars = [
    { x: 46, color: "#10B981", h: 78, pct: "100%" },
    { x: 130, color: "#0E7C7B", h: 48, pct: "62%" },
    { x: 214, color: "#EF4444", h: 22, pct: "28%" },
  ];
  const baseY = 120;

  return (
    <svg
      viewBox="0 0 320 148"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <marker
          id="refreshArrow"
          viewBox="0 0 8 8"
          refX="7"
          refY="4"
          markerWidth="5"
          markerHeight="5"
          orient="auto"
        >
          <path d="M 0 0 L 8 4 L 0 8 Z" fill="#10B981" fillOpacity="0.5" />
        </marker>
      </defs>
      {/* Grid lines */}
      {[0, 33, 66, 100].map((pct, i) => {
        const y = baseY - (pct / 100) * 90;
        return (
          <line
            key={i}
            x1="28"
            y1={y}
            x2="292"
            y2={y}
            stroke="#E2E8F0"
            strokeOpacity={pct === 0 ? 0.8 : 0.35}
            strokeWidth={pct === 0 ? 1.5 : 0.8}
          />
        );
      })}
      {/* Bars */}
      {bars.map(({ x, color, h, pct }, i) => (
        <g key={i}>
          <rect
            x={x}
            y={baseY - 90}
            width={62}
            height={90}
            rx="4"
            fill={color}
            fillOpacity="0.04"
          />
          <rect
            x={x}
            y={baseY - h}
            width={62}
            height={h}
            rx="4"
            fill={color}
            fillOpacity="0.14"
            stroke={color}
            strokeOpacity="0.3"
            strokeWidth="1.5"
          />
          <rect
            x={x + 5}
            y={baseY - h + 5}
            width={9}
            height={Math.max(h - 12, 4)}
            rx="2"
            fill={color}
            fillOpacity="0.14"
          />
          <text
            x={x + 31}
            y={baseY - h - 7}
            textAnchor="middle"
            fontSize="9"
            fontWeight="700"
            fill={color}
            fillOpacity="0.7"
            fontFamily="system-ui, sans-serif"
          >
            {pct}
          </text>
          <circle
            cx={x + 31}
            cy={baseY + 12}
            r="4"
            fill={color}
            fillOpacity="0.28"
          />
        </g>
      ))}
      {/* Refresh arc */}
      <path
        d="M 258 72 Q 296 28 296 70 Q 296 112 258 106"
        stroke="#10B981"
        strokeOpacity="0.32"
        strokeWidth="2"
        strokeDasharray="5 3"
        fill="none"
        markerEnd="url(#refreshArrow)"
      />
      {/* ↺ icon */}
      <circle
        cx="276"
        cy="74"
        r="17"
        fill="#10B981"
        fillOpacity="0.07"
        stroke="#10B981"
        strokeOpacity="0.18"
        strokeWidth="1.5"
      />
      <path
        d="M 270 74 Q 270 66 276 66 Q 282 66 282 72"
        stroke="#10B981"
        strokeOpacity="0.45"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 282 72 L 285 67 L 288 72"
        stroke="#10B981"
        strokeOpacity="0.45"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Base line */}
      <line
        x1="28"
        y1={baseY}
        x2="292"
        y2={baseY}
        stroke="#E2E8F0"
        strokeWidth="1.5"
      />
    </svg>
  );
}

// ── Why it matters (intro stats) ─────────────────────────────────────────────

const WHY_MATTERS = [
  {
    emoji: "trust" as const,
    stat: "80%",
    label: "of agent mistakes",
    detail:
      "happen because the right information was missing — not because the AI failed.",
  },
  {
    emoji: "member" as const,
    stat: "3×",
    label: "faster answers",
    detail:
      "when the agent has clear, current information instead of guessing.",
  },
  {
    emoji: "docs" as const,
    stat: "0",
    label: "wrong answers",
    detail: "when every response is backed by an official source you provided.",
  },
];

// ── Playbook — 5 steps ────────────────────────────────────────────────────────

interface PlaybookStep {
  step: number;
  emoji: KBHKIEmojiKey;
  color: string;
  Illustration: (props: { className?: string }) => ReactElement;
  title: string;
  why: string;
  actions: string[];
  pitfall: string;
}

const PLAYBOOK: PlaybookStep[] = [
  {
    step: 1,
    emoji: "member",
    color: "blue",
    Illustration: IllustrationDecide,
    title: "Map the questions your agent needs to answer",
    why: "The agent can only answer what you've given it. Start by listing the 10 most common questions your users will actually ask — then find the document that answers each one.",
    actions: [
      "Talk to 3–5 people who will use the agent. Write down the exact questions they ask most often.",
      "For each question, find the document, policy, or guide that has the answer. If it doesn't exist — create it.",
      'Use the "Find What\'s Missing" tool to spot topics you may have overlooked.',
    ],
    pitfall:
      "Uploading everything without a plan makes it harder for the agent to find the right answer.",
  },
  {
    step: 2,
    emoji: "docs",
    color: "blue",
    Illustration: IllustrationQuality,
    title: "Choose quality over quantity",
    why: "20 clear, well-structured documents work better than 200 messy ones. The agent looks for the most relevant answer — not the most content.",
    actions: [
      "Use official guides, approved policies, and training materials — not rough drafts or personal notes.",
      "Remove duplicates and outdated versions. Stale content produces wrong answers.",
      "Favor documents with clear headings, numbered steps, and Q&A sections.",
    ],
    pitfall:
      "Scanned images, slide decks with only pictures, and number-heavy spreadsheets won't help the agent.",
  },
  {
    step: 3,
    emoji: "warehouse",
    color: "violet",
    Illustration: IllustrationOrganize,
    title: "Organize by topic, not by person",
    why: "The way you arrange your files tells the agent what each document is about. Topic-based folders mean better, more targeted answers.",
    actions: [
      "Create one main folder and use subfolders by type: Guides / Policies / FAQs / Training.",
      "Organize by what the content is about — not who created it.",
      "Keep it simple: no more than 3 folder levels deep.",
    ],
    pitfall:
      'Folders like "John\'s Docs" or "Team A" tell the agent nothing about what\'s inside.',
  },
  {
    step: 4,
    emoji: "test",
    color: "amber",
    Illustration: IllustrationTest,
    title: "Test every answer before going live",
    why: "An answer that sounds right but is wrong is dangerous. Always verify your agent gives correct answers before sharing it with your team.",
    actions: [
      "Ask the same top-10 questions from Step 1. Check the answer and which documents it pulled.",
      "Ask questions the agent shouldn't know. It should say \"I don't know\" — not guess.",
      "A health score above 70% plus correct top-10 answers means you're ready to launch.",
    ],
    pitfall:
      "A confident-sounding answer is not the same as a correct one. Always verify against the source.",
  },
  {
    step: 5,
    emoji: "refresh",
    color: "orange",
    Illustration: IllustrationFresh,
    title: "Keep it fresh — and assign owners",
    why: "Outdated information is worse than no information. Assign one owner per topic area and review content monthly so your agent stays accurate as things change.",
    actions: [
      "Assign one owner per topic area (Guides, Policies, FAQs) — they keep their section current.",
      "Connect Google Drive or SharePoint so documents sync automatically.",
      "Set a monthly reminder: run gap analysis, review pending content, and fix any reported bad answers right away.",
    ],
    pitfall:
      "Setting it up once and forgetting it. The best domain libraries are maintained as living documents.",
  },
];

// ── Attestation commitments ───────────────────────────────────────────────────

const COMMITMENTS = [
  {
    emoji: "docs" as const,
    title: "Reliable content only",
    body: "We will upload clear, reliable content — not just everything we can find.",
  },
  {
    emoji: "team" as const,
    title: "Named owners",
    body: "We will assign someone to own each topic area and keep it up to date.",
  },
  {
    emoji: "test" as const,
    title: "Test before launch",
    body: "We will test the agent's answers before sharing it with our team.",
  },
  {
    emoji: "refresh" as const,
    title: "Refresh on cadence",
    body: "We will review and refresh our content regularly — at least once a month.",
  },
  {
    emoji: "trust" as const,
    title: "Trust starts with source quality",
    body: "We understand that the agent is only as good as the information we give it.",
  },
] as const;

const AFTER_LAUNCH_GUIDANCE = [
  {
    emoji: "launch" as const,
    title: "Deployment",
    body: "Pilot with a small audience, publish from a tested release, and keep one escalation path for bad answers.",
  },
  {
    emoji: "operations" as const,
    title: "Operations",
    body: "Run gap analysis continuously, review queue health weekly, and treat every bad answer as a fix-forward signal.",
  },
] as const;

// ── Component ─────────────────────────────────────────────────────────────────

interface DriveOrganizeGuideProps {
  streamLabel?: string;
  valueStreamId?: string;
  onBack: () => void;
}

const TOTAL_STEPS = PLAYBOOK.length;
const INTRO_IDX = -1;
const ATTEST_IDX = TOTAL_STEPS;

export default function DriveOrganizeGuide({
  streamLabel,
  valueStreamId,
  onBack,
}: DriveOrganizeGuideProps) {
  const streamId = valueStreamId ?? "global";

  const attestQ = trpc.knowledge.getAttestation.useQuery(
    { valueStreamId: streamId },
    { retry: false, refetchOnWindowFocus: false }
  );
  const attestMut = trpc.knowledge.attestPlaybook.useMutation({
    onSuccess: () => {
      attestQ.refetch();
      onBack();
    },
  });

  const [current, setCurrent] = useState<number>(INTRO_IDX);
  const [attested, setAttested] = useState(false);
  const [direction, setDirection] = useState<1 | -1>(1);

  const advance = () => {
    setDirection(1);
    setCurrent(c => Math.min(c + 1, ATTEST_IDX));
  };

  const handleAttest = () => {
    attestMut.mutate({ valueStreamId: streamId });
  };

  if (attestQ.data?.attested) {
    return (
      <AlreadyAttestedView
        streamLabel={streamLabel}
        attestedAt={attestQ.data.attestedAt}
        onBack={onBack}
      />
    );
  }

  const isIntro = current === INTRO_IDX;
  const isAttest = current === ATTEST_IDX;
  const playbookStep = !isIntro && !isAttest ? PLAYBOOK[current] : null;

  const variants = {
    enter: (d: number) => ({ opacity: 0, x: d > 0 ? 48 : -48 }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => ({ opacity: 0, x: d > 0 ? -48 : 48 }),
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-200px)]">
      <div className="w-full max-w-3xl mx-auto px-4 pt-2 pb-10">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            className={cn(
              "flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg",
              "text-muted-foreground hover:text-foreground",
              "hover:bg-black/5 dark:hover:bg-white/5 transition-all"
            )}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          {/* Progress dots */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: TOTAL_STEPS + 2 }).map((_, i) => {
              const idx = i - 1;
              const done = idx < current;
              const active = idx === current;
              return (
                <div
                  key={i}
                  className={cn(
                    "rounded-full transition-all duration-300",
                    active
                      ? "w-5 h-2 bg-primary"
                      : done
                        ? "w-2 h-2 bg-primary/80"
                        : "w-2 h-2 bg-black/10 dark:bg-muted"
                  )}
                />
              );
            })}
          </div>

          <span className={cn("text-xs tabular-nums", k.muted)}>
            {isIntro
              ? "Intro"
              : isAttest
                ? "Confirm"
                : `${current + 1} of ${TOTAL_STEPS}`}
          </span>
        </div>

        {/* Animated panel */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={current}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          >
            {/* ── INTRO ── */}
            {isIntro && (
              <div className={cn(k.card, "p-8 space-y-7")}>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <KBEmojiBadge emoji="policy" size="sm" />
                    <span className="text-xs font-bold uppercase tracking-wider text-primary">
                      Getting Started Guide
                    </span>
                    {streamLabel && (
                      <span className="text-xs px-2 py-0.5 rounded-full kb-duotone-fill font-medium">
                        {streamLabel}
                      </span>
                    )}
                  </div>
                  <h1
                    className={cn(
                      "text-2xl md:text-3xl font-bold mb-3",
                      k.heading
                    )}
                  >
                    How to set your agent up for success
                  </h1>
                  <p
                    className={cn(
                      "text-base md:text-lg leading-relaxed",
                      k.muted
                    )}
                  >
                    The AI is only as good as the information you give it. Teams
                    that invest in great content build agents people trust — and
                    actually use.
                  </p>
                </div>

                {/* Visual knowledge → agent → trust flow */}
                <div className="flex items-center justify-center gap-2 py-2">
                  {(
                    [
                      { emoji: "docs", label: "Great knowledge" },
                      { emoji: "member", label: "Smart agent" },
                      { emoji: "trust", label: "Right answers" },
                    ] as { emoji: KBHKIEmojiKey; label: string }[]
                  ).map((node, i) => (
                    <div key={i} className="flex items-center gap-2">
                      {i > 0 && (
                        <ChevronRight className="w-5 h-5 text-primary/30 shrink-0" />
                      )}
                      <div className="flex flex-col items-center gap-1.5">
                        <KBEmojiBadge emoji={node.emoji} />
                        <span
                          className={cn(
                            "text-xs font-semibold text-center",
                            k.muted
                          )}
                        >
                          {node.label}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  {WHY_MATTERS.map((w, i) => (
                    <div
                      key={i}
                      className="p-4 rounded-xl bg-muted dark:bg-muted/60 text-center"
                    >
                      <div className="mb-3 flex justify-center">
                        <KBEmojiBadge emoji={w.emoji} />
                      </div>
                      <p className="text-3xl font-black text-primary tabular-nums">
                        {w.stat}
                      </p>
                      <p
                        className={cn(
                          "text-sm font-semibold mt-0.5",
                          k.heading
                        )}
                      >
                        {w.label}
                      </p>
                      <p
                        className={cn("text-xs mt-1 leading-relaxed", k.muted)}
                      >
                        {w.detail}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Notice */}
                <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/8 dark:bg-primary/8 border border-primary/20 dark:border-primary/20">
                  <Lock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-base font-semibold text-primary">
                      Please read before continuing
                    </p>
                    <p className="text-base text-primary mt-0.5">
                      This guide has {TOTAL_STEPS} short sections. Read each one
                      and confirm at the end — about 5 minutes.
                    </p>
                  </div>
                </div>

                <button
                  data-testid="kb-guide-start"
                  onClick={advance}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-white font-semibold text-base transition-all"
                >
                  Let's get started — Section 1 of {TOTAL_STEPS}
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* ── PLAYBOOK STEP ── */}
            {playbookStep &&
              (() => {
                const s = playbookStep;
                const colors = STEP_COLOR[s.color] ?? STEP_COLOR.blue;
                const { Illustration } = s;
                return (
                  <div className={cn(k.card, "overflow-hidden")}>
                    {/* Illustration hero */}
                    <div className="relative bg-muted/40 dark:bg-muted/25 px-6 pt-6 pb-2">
                      <Illustration className="w-full h-40" />
                      <div className="absolute top-4 right-4">
                        <span
                          className={cn(
                            "text-xs font-bold px-2.5 py-1 rounded-full",
                            colors.bg,
                            colors.text
                          )}
                        >
                          {s.step} / {TOTAL_STEPS}
                        </span>
                      </div>
                    </div>

                    {/* Thin color bar */}
                    <div className={cn("h-0.5 w-full", colors.bar)} />

                    <div className="p-7 space-y-5">
                      {/* Header */}
                      <div className="flex items-start gap-3">
                        <KBEmojiBadge emoji={s.emoji} />
                        <h2
                          className={cn(
                            "text-xl md:text-2xl font-bold leading-snug",
                            k.heading
                          )}
                        >
                          {s.title}
                        </h2>
                      </div>

                      {/* Why */}
                      <div className="flex items-start gap-3 p-4 rounded-xl bg-muted dark:bg-muted/60">
                        <Lightbulb className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                        <p
                          className={cn(
                            "text-base md:text-lg leading-relaxed",
                            k.muted
                          )}
                        >
                          {s.why}
                        </p>
                      </div>

                      {/* Actions */}
                      <div>
                        <p
                          className={cn(
                            "text-sm font-bold uppercase tracking-wider mb-3",
                            k.label
                          )}
                        >
                          What to do
                        </p>
                        <ul className="space-y-3">
                          {s.actions.map((action, j) => (
                            <li key={j} className="flex items-start gap-3">
                              <div
                                className={cn(
                                  "w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-sm font-black mt-0.5",
                                  colors.bg,
                                  colors.text
                                )}
                              >
                                {j + 1}
                              </div>
                              <span
                                className={cn(
                                  "text-base md:text-lg leading-relaxed",
                                  k.muted
                                )}
                              >
                                {action}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Pitfall */}
                      <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-500/8 border border-red-100 dark:border-red-500/15">
                        <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
                        <p className="text-base text-red-600 dark:text-red-400 leading-relaxed">
                          <strong className="font-semibold">Watch out:</strong>{" "}
                          {s.pitfall}
                        </p>
                      </div>

                      {/* Next */}
                      <button
                        data-testid="kb-guide-next"
                        onClick={advance}
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-white font-semibold text-base transition-all"
                      >
                        <CheckCircle className="w-5 h-5" />
                        {current < TOTAL_STEPS - 1
                          ? `Got it — Section ${current + 2} of ${TOTAL_STEPS}`
                          : "Got it — Almost done!"}
                      </button>
                    </div>
                  </div>
                );
              })()}

            {/* ── ATTESTATION ── */}
            {isAttest && (
              <div className={cn(k.card, "p-8 space-y-6")}>
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                    <BadgeCheck className="w-8 h-8 text-primary" />
                  </div>
                  <h2
                    className={cn("text-2xl md:text-3xl font-bold", k.heading)}
                  >
                    You're all done!
                  </h2>
                  <p className={cn("text-base md:text-lg", k.muted)}>
                    One last step — confirm your team is on board with these
                    commitments.
                  </p>
                </div>

                {/* Commitments */}
                <div className="space-y-2">
                  {COMMITMENTS.map(c => (
                    <div
                      key={c.title}
                      className="flex items-start gap-3 p-3 rounded-xl bg-muted dark:bg-muted/60 border border-border/30"
                    >
                      <KBEmojiBadge emoji={c.emoji} size="sm" />
                      <div>
                        <p className={cn("text-sm font-semibold", k.heading)}>
                          {c.title}
                        </p>
                        <p
                          className={cn(
                            "text-sm leading-relaxed mt-0.5",
                            k.muted
                          )}
                        >
                          {c.body}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* After-launch guidance */}
                <div className="grid gap-3 md:grid-cols-2">
                  {AFTER_LAUNCH_GUIDANCE.map(item => (
                    <div
                      key={item.title}
                      className="rounded-2xl border border-border/30 bg-background/70 p-4 shadow-sm"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <KBEmojiBadge emoji={item.emoji} size="sm" />
                        <p className={cn("text-sm font-semibold", k.heading)}>
                          {item.title}
                        </p>
                      </div>
                      <p className={cn("text-sm leading-relaxed", k.muted)}>
                        {item.body}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Attestation checkbox */}
                <label
                  className={cn(
                    "flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all select-none",
                    attested
                      ? "border-primary/35 bg-primary/8 shadow-[0_16px_36px_-28px_rgba(14,124,123,0.65)]"
                      : "border-border/30 hover:border-primary/45 hover:bg-primary/[0.035]"
                  )}
                >
                  <input
                    data-testid="kb-guide-attest-checkbox"
                    type="checkbox"
                    checked={attested}
                    onChange={e => setAttested(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-primary shrink-0"
                  />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <KBEmojiBadge emoji="rollout" size="sm" />
                      <span className={cn("text-sm font-semibold", k.heading)}>
                        Team commitment confirmed
                      </span>
                    </div>
                    <p className={cn("text-sm leading-relaxed", k.muted)}>
                      I've read through this guide and I'm ready to set up the
                      domain library for{" "}
                      <strong>{streamLabel ?? "my team"}</strong>.
                    </p>
                  </div>
                </label>

                <button
                  data-testid="kb-guide-attest-submit"
                  onClick={handleAttest}
                  disabled={!attested}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-base transition-all",
                    attested
                      ? "bg-primary text-white shadow-sm"
                      : "bg-black/5 dark:bg-muted/60 text-muted-foreground/50 cursor-not-allowed"
                  )}
                >
                  <BadgeCheck className="w-5 h-5" />
                  {attestMut.isPending
                    ? "Saving…"
                    : attested
                      ? "I'm ready — let's go!"
                      : "Check the box above to continue"}
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Already attested (read-only) ──────────────────────────────────────────────

function AlreadyAttestedView({
  streamLabel,
  attestedAt,
  onBack,
}: DriveOrganizeGuideProps & { attestedAt?: string | null }) {
  return (
    <div className="flex flex-col min-h-[calc(100vh-200px)]">
      <div className="w-full max-w-3xl mx-auto px-4 pt-2 pb-10 space-y-5">
        <button
          onClick={onBack}
          className={cn(
            "flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg",
            "text-muted-foreground hover:text-foreground",
            "hover:bg-black/5 dark:hover:bg-white/5 transition-all"
          )}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Overview
        </button>

        <div className={cn(k.card, "p-5 flex items-center gap-4")}>
          <KBEmojiBadge emoji="launch" />
          <div>
            <p className={cn("text-base font-semibold", k.heading)}>
              Guide completed
            </p>
            <p className={cn("text-base mt-0.5", k.muted)}>
              {streamLabel ?? "Your team"} has completed the Getting Started
              Guide
              {attestedAt
                ? ` on ${new Date(attestedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                : ""}
              .
            </p>
          </div>
        </div>

        {/* After-launch guidance */}
        <div className="grid gap-3 md:grid-cols-2">
          {AFTER_LAUNCH_GUIDANCE.map(item => (
            <div
              key={item.title}
              className={cn(k.card, "p-4 border border-border/30")}
            >
              <div className="flex items-center gap-3 mb-2">
                <KBEmojiBadge emoji={item.emoji} size="sm" />
                <p className={cn("text-sm font-semibold", k.heading)}>
                  {item.title}
                </p>
              </div>
              <p className={cn("text-sm leading-relaxed", k.muted)}>
                {item.body}
              </p>
            </div>
          ))}
        </div>

        {/* Read-only step summaries */}
        <div className="space-y-3">
          {PLAYBOOK.map(s => {
            const colors = STEP_COLOR[s.color] ?? STEP_COLOR.blue;
            const { Illustration } = s;
            return (
              <div
                key={s.step}
                className={cn(
                  k.card,
                  "overflow-hidden border-l-4",
                  colors.border
                )}
              >
                {/* Compact illustration */}
                <div className="bg-muted/30 dark:bg-muted/20 px-5 pt-4 pb-1">
                  <Illustration className="w-full h-28" />
                </div>
                <div className="p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <KBEmojiBadge emoji={s.emoji} size="sm" />
                    <div>
                      <span
                        className={cn(
                          "text-xs font-bold uppercase tracking-wider",
                          colors.text
                        )}
                      >
                        Section {s.step}
                      </span>
                      <h3 className={cn("text-base font-semibold", k.heading)}>
                        {s.title}
                      </h3>
                    </div>
                  </div>
                  <p className={cn("text-sm leading-relaxed mb-3", k.muted)}>
                    {s.why}
                  </p>
                  <ul className="space-y-1.5">
                    {s.actions.map((action, j) => (
                      <li key={j} className="flex items-start gap-2">
                        <ChevronRight
                          className={cn(
                            "w-4 h-4 mt-0.5 shrink-0",
                            colors.chevron
                          )}
                        />
                        <span
                          className={cn("text-sm leading-relaxed", k.muted)}
                        >
                          {action}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
