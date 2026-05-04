/**
 * AgenticReadinessMeter
 *
 * The C arc of the Agentic brand mark is the readiness gauge.
 * The arc fills via CSS stroke-dashoffset as the KB score grows.
 * The arrow is always present — it's part of the identity.
 * At 100% the whole logo snaps to full brand colors with a brief pulse.
 *
 * Colors stay brand-consistent in both light and dark:
 *   blue C arc · red core · red arrow
 */

import { cn, COSTCO_BLUE, COSTCO_RED, brandColors } from "@hki/ui";
import { healthColor } from "./maturity-model";
import type { MaturityResult } from "./maturity-model";

// ── Brand palette — sourced from @hki/ui design tokens ────────────────────
const B_BLUE = COSTCO_BLUE; // #0066B2
const B_BLUE_MID = brandColors.blue[400] as string; // #3397D7 — lighter arc start
const B_BLUE_DEEP = brandColors.blue[700] as string; // #003E6B — deeper arc end
const B_RED = COSTCO_RED; // #E31837
const B_RED_DEEP = brandColors.red[700] as string; // #880E21 — deeper red end

// C arc geometry (viewBox 0 0 100 100, r=27, center 50,50)
// Angle span ≈ 288°  →  arc length ≈ 135.7
const ARC_PATH = "M72 34 A 27 27 0 1 0 72 66";
const ARC_LENGTH = 136;

// ── Component ─────────────────────────────────────────────────────────────────
interface AgenticReadinessMeterProps {
  maturity: MaturityResult;
  stepsCompleted: number;
  totalSteps: number;
  className?: string;
  size?: "default" | "compact" | "hero";
  showLabel?: boolean;
}

export function AgenticReadinessMeter({
  maturity,
  stepsCompleted,
  totalSteps,
  className,
  size = "default",
  showLabel = true,
}: AgenticReadinessMeterProps) {
  const score = maturity.overall;
  const hc = healthColor(score);
  const progress = Math.min(score / 100, 1);
  const isComplete = score >= 98;
  const isCompact = size === "compact";
  const isHero = size === "hero";
  const svgSize = isHero ? 164 : isCompact ? 128 : 148;

  const arcStart = B_BLUE_MID;
  const arcEnd = B_BLUE_DEEP;
  const coreStart = B_RED;
  const coreMid = B_RED;
  const coreEnd = B_RED_DEEP;
  const arrowClr = B_RED;
  const capClr = B_BLUE;
  const trackClr = B_BLUE;

  // CSS stroke-dashoffset drives the fill — no per-element animation framework
  const dashOffset = ARC_LENGTH - progress * ARC_LENGTH;
  const arcTransition =
    "stroke-dashoffset 1.4s cubic-bezier(0.22,1,0.36,1) 0.2s, opacity 0.4s ease 0.2s";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center select-none",
        isHero
          ? "gap-3 px-0 py-0"
          : isCompact
            ? "gap-2 px-4 py-4"
            : "gap-2 px-6 py-6",
        className
      )}
    >
      {/* ── SVG + score overlay ── */}
      <div className="relative">
        <svg
          width={svgSize}
          height={svgSize}
          viewBox="0 0 100 100"
          fill="none"
          style={{ overflow: "visible" }}
          aria-label={`Knowledge readiness: ${score} of 100`}
        >
          <defs>
            {/* Arc fill gradient — brand colors throughout */}
            <linearGradient
              id="am-arc-grad"
              x1="20"
              y1="18"
              x2="72"
              y2="82"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor={arcStart} stopOpacity="0.85" />
              <stop offset="100%" stopColor={arcEnd} />
            </linearGradient>

            {/* Core radial — matches AgenticIcon core */}
            <radialGradient id="am-core-grad" cx="48%" cy="44%" r="50%">
              <stop offset="0%" stopColor={coreStart} />
              <stop offset="60%" stopColor={coreMid} />
              <stop offset="100%" stopColor={coreEnd} />
            </radialGradient>
          </defs>

          {/* Ghost track — full C silhouette at low opacity */}
          <path
            d={ARC_PATH}
            stroke={trackClr}
            strokeWidth="7"
            strokeLinecap="round"
            fill="none"
            opacity="0.1"
          />

          {/* ── Progress arc — CSS stroke-dashoffset fill ── */}
          <path
            d={ARC_PATH}
            stroke="url(#am-arc-grad)"
            strokeWidth="7"
            strokeLinecap="round"
            fill="none"
            style={{
              strokeDasharray: ARC_LENGTH,
              strokeDashoffset: dashOffset,
              opacity: score > 0 ? 1 : 0,
              transition: arcTransition,
            }}
          />

          {/* Top endpoint cap */}
          <circle
            cx="72"
            cy="34"
            r="2"
            fill={capClr}
            opacity={score > 4 ? 0.6 : 0}
            style={{ transition: "opacity 0.3s ease 0.5s" }}
          />
          {/* Bottom endpoint cap */}
          <circle
            cx="72"
            cy="66"
            r="2"
            fill={capClr}
            opacity={score > 86 ? 0.6 : 0}
            style={{ transition: "opacity 0.3s ease" }}
          />

          {/* Core ring */}
          <circle
            cx="50"
            cy="50"
            r="9"
            fill="none"
            stroke="#fff"
            strokeWidth="1"
            opacity={Math.min(score / 50, 1) * 0.12}
            style={{ transition: "opacity 0.6s ease" }}
          />
          {/* Core sphere */}
          <circle
            cx="50"
            cy="50"
            r="8"
            fill="url(#am-core-grad)"
            opacity={Math.min(score / 25, 1)}
            style={{
              transform: `scale(${Math.min(0.3 + (score / 25) * 0.7, 1)})`,
              transformOrigin: "50px 50px",
              transition:
                "opacity 0.6s ease, transform 0.6s cubic-bezier(0.22,1,0.36,1)",
            }}
          />
          {/* Core specular highlight */}
          <ellipse
            cx="48"
            cy="48"
            rx="3"
            ry="2"
            fill="#fff"
            opacity={Math.min(score / 35, 1) * 0.38}
            style={{ transition: "opacity 0.4s ease" }}
          />

          {/* ── Arrow — rotates as a gauge needle ────────────────────────────
               Tracks the arc's leading edge as the score grows.
               At 0 %  → points toward the arc start  (≈ −36°, upper-right)
               At 100% → snaps to 0° (horizontal right) = exact Agentic logo */}
          <g
            style={{
              transform: `rotate(${isComplete ? 0 : -(36 + 288 * progress)}deg)`,
              transformOrigin: "50px 50px",
              transition:
                "transform 0.9s cubic-bezier(0.22,1,0.36,1) 0.1s, opacity 0.5s ease",
              opacity: Math.min(score / 10, 1),
            }}
          >
            <path
              d="M58 50 L78 50"
              stroke={arrowClr}
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M71 44 L78 50 L71 56"
              stroke={arrowClr}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </g>
        </svg>

        {/* Center — empty while reading; "Ready" at completion */}
        {isComplete && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-xs font-bold tracking-widest uppercase text-primary">
              Ready
            </span>
          </div>
        )}
      </div>

      {showLabel && (
        <p
          className={cn(
            "text-xs font-semibold leading-none tracking-wide -mt-1",
            hc.textCls
          )}
        >
          {hc.label}
        </p>
      )}
    </div>
  );
}
