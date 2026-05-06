import React, { useId, useSyncExternalStore } from "react";

const IRIS = "#0E7C7B";
const IRIS_LIGHT = "#2EA39E";
const CORE = "#0A8F8B";
const CORE_LIGHT = "#5ECAC4";

function subscribeDark(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => obs.disconnect();
}
function getIsDark() {
  return document.documentElement.classList.contains("dark");
}
function useDarkMode() {
  return useSyncExternalStore(subscribeDark, getIsDark, () => false);
}

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  animated?: boolean;
}

/**
 * Hermetic — Agentic Brand Mark ("The Seal")
 *
 * A closed concentric perimeter with a single inner core, expressing the
 * Hermetic contract: one request, one sealed domain, one controlled crossing
 * point at the seam. No open arc, no leakage arrow.
 */
export function AgenticIcon({
  size = 48,
  animated = false,
  className = "",
  style,
  ...props
}: IconProps) {
  const uid = useId().replace(/:/g, "");
  const id = (s: string) => `seal-${s}-${uid}`;
  const dark = useDarkMode();

  const seal = dark ? IRIS_LIGHT : IRIS;
  const core = dark ? CORE_LIGHT : CORE;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 400 400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className || undefined}
      aria-label="Hermetic"
      shapeRendering="geometricPrecision"
      style={{
        ...(animated ? { filter: `drop-shadow(0 10px 18px ${core}3d)` } : null),
        ...style,
      }}
      {...props}
    >
      <defs>
        <radialGradient id={id("field")} cx="50%" cy="50%" r="54%">
          <stop offset="0%" stopColor={core} stopOpacity="0.2" />
          <stop offset="60%" stopColor={core} stopOpacity="0.08" />
          <stop offset="100%" stopColor={core} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("core")} cx="42%" cy="38%" r="60%">
          <stop offset="0%" stopColor={core} stopOpacity="1" />
          <stop offset="70%" stopColor={core} stopOpacity="0.92" />
          <stop offset="100%" stopColor={core} stopOpacity="0.78" />
        </radialGradient>
      </defs>

      {animated && (
        <>
          <circle cx="200" cy="200" r="172" fill={`url(#${id("field")})`} />
          <circle
            cx="200"
            cy="200"
            r="158"
            stroke={core}
            strokeWidth="8"
            fill="none"
            opacity="0.22"
          >
            <animate
              attributeName="r"
              values="146;166;146"
              dur="1.8s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.12;0.36;0.12"
              dur="1.8s"
              repeatCount="indefinite"
            />
          </circle>
        </>
      )}

      {/* Outer perimeter — the hermetic seal (closed, no break) */}
      <circle
        cx="200"
        cy="200"
        r="140"
        stroke={seal}
        strokeWidth={animated ? "28" : "24"}
        strokeOpacity={animated ? "0.98" : "1"}
        fill="none"
      />

      {animated && (
        <circle
          cx="200"
          cy="200"
          r="140"
          stroke={core}
          strokeWidth="31"
          strokeLinecap="round"
          strokeDasharray="126 754"
          fill="none"
          opacity="0.92"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 200 200"
            to="360 200 200"
            dur="2.8s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.56;1;0.56"
            dur="1.4s"
            repeatCount="indefinite"
          />
        </circle>
      )}

      {/* Inner perimeter — defense in depth */}
      <circle
        cx="200"
        cy="200"
        r="92"
        stroke={seal}
        strokeOpacity={animated ? "0.54" : "0.32"}
        strokeWidth={animated ? "5" : "4"}
        fill="none"
      />

      {/* Active scope — the single request inside the seal */}
      {animated ? (
        <circle cx="200" cy="200" r="32" fill={`url(#${id("core")})`}>
          <animate
            attributeName="r"
            values="29;37;29"
            dur="1.4s"
            repeatCount="indefinite"
          />
        </circle>
      ) : (
        <circle cx="200" cy="200" r="26" fill={`url(#${id("core")})`} />
      )}
      <circle
        cx="192"
        cy="192"
        r={animated ? "10" : "8"}
        fill="#fff"
        opacity={animated ? "0.5" : "0.32"}
      />

      {/* Seam mark — the sole controlled crossing point (publication interface) */}
      {animated ? (
        <circle cx="200" cy="60" r="13" fill={core} opacity="0.72">
          <animate
            attributeName="r"
            values="11;15;11"
            dur="1.4s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.72;1;0.72"
            dur="1.4s"
            repeatCount="indefinite"
          />
        </circle>
      ) : (
        <circle cx="200" cy="60" r="10" fill={core} />
      )}
      <line
        x1="200"
        y1="50"
        x2="200"
        y2="70"
        stroke={dark ? "#0a0a0a" : "#fff"}
        strokeWidth={animated ? "3.25" : "2.5"}
        strokeLinecap="round"
      />
    </svg>
  );
}

export default AgenticIcon;
