/**
 * HKI Brand System — Mark, Logo, Wordmark
 *
 * Inline-SVG components: no external asset dependency, work in every context
 * (SSR, email, canvas, PDF). The H mark uses a clipPath + gradient so a single
 * gradient rect covers the entire glyph uniformly.
 *
 * Usage:
 *   <HkiMark size="md" variant="color" />
 *   <HkiLogo size="lg" variant="color" />
 *   <HkiLogo layout="stacked" />
 *
 * @module @hki/ui/components/branding
 */

import * as React from "react";

import { cn } from "../utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const IRIS = "var(--hki-iris-500)";
const PULSE = "var(--hki-pulse-500)";
const IRIS_LIGHT = "var(--hki-iris-300)";
const PULSE_LIGHT = "var(--hki-pulse-300)";
const TEXT_ON_DARK = "var(--neutral-0)";
const TEXT_STRONG = "var(--neutral-900)";
const TEXT_BODY = "var(--neutral-700)";
const TEXT_MUTED = "var(--neutral-500)";
const TEXT_MUTED_ON_DARK = "var(--neutral-400)";
const SUBTLE_ON_DARK = "color-mix(in srgb, var(--neutral-0) 55%, transparent)";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BrandVariant =
  | "color" // Aurora gradient  (default)
  | "color-dark" // Aurora gradient brightened for dark backgrounds
  | "white" // Solid white — for colored/photo backgrounds
  | "dark" // Near-black — for light backgrounds
  | "iris" // Solid HKI Iris
  | "pulse"; // Solid HKI Pulse

export type MarkSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

export type LogoLayout = "horizontal" | "stacked";

const MARK_PX: Record<MarkSize, number> = {
  xs: 16,
  sm: 24,
  md: 32,
  lg: 48,
  xl: 64,
  "2xl": 96,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveMarkFill(variant: BrandVariant, gradId: string): string {
  switch (variant) {
    case "white":
      return TEXT_ON_DARK;
    case "dark":
      return TEXT_STRONG;
    case "iris":
      return IRIS;
    case "pulse":
      return PULSE;
    case "color-dark":
      return `url(#${gradId})`;
    default:
      return `url(#${gradId})`;
  }
}

function resolveTextFill(variant: BrandVariant): {
  title: string;
  sub: string;
} {
  switch (variant) {
    case "white":
      return { title: TEXT_ON_DARK, sub: SUBTLE_ON_DARK };
    case "dark":
      return { title: TEXT_STRONG, sub: TEXT_MUTED };
    case "iris":
      return { title: IRIS, sub: TEXT_MUTED };
    case "pulse":
      return { title: PULSE, sub: TEXT_MUTED };
    case "color-dark":
      return { title: TEXT_ON_DARK, sub: TEXT_MUTED };
    default:
      return { title: TEXT_BODY, sub: TEXT_MUTED_ON_DARK };
  }
}

// ─── HkiMark ─────────────────────────────────────────────────────────────────

export interface HkiMarkProps extends React.SVGProps<SVGSVGElement> {
  /** Pixel size or named step (default: "md" = 32px) */
  size?: MarkSize | number;
  variant?: BrandVariant;
}

/**
 * The HKI H-mark glyph. Use for favicons, avatars, loading screens.
 * Renders as an inline SVG — no img tag, no CORS, SSR-safe.
 */
export const HkiMark = React.forwardRef<SVGSVGElement, HkiMarkProps>(
  ({ size = "md", variant = "color", className, ...props }, ref) => {
    const px = typeof size === "number" ? size : MARK_PX[size];
    const uid = React.useId().replace(/:/g, "");
    const gradId = `hki-mg-${uid}`;
    const isDark = variant === "color-dark";

    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 40 40"
        width={px}
        height={px}
        aria-label="HKI"
        role="img"
        className={cn("shrink-0 select-none", className)}
        {...props}
      >
        <defs>
          {(variant === "color" || variant === "color-dark") && (
            <linearGradient
              id={gradId}
              x1="3"
              y1="3"
              x2="37"
              y2="37"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor={isDark ? IRIS_LIGHT : IRIS} />
              <stop offset="100%" stopColor={isDark ? PULSE_LIGHT : PULSE} />
            </linearGradient>
          )}
        </defs>
        {/* Hermetic isolation ring */}
        <circle
          cx="20"
          cy="20"
          r="17"
          fill="none"
          stroke={resolveMarkFill(variant, gradId)}
          strokeWidth="1.5"
        />
        {/* H left pillar */}
        <line
          x1="12"
          y1="5"
          x2="12"
          y2="35"
          stroke={resolveMarkFill(variant, gradId)}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* H right pillar */}
        <line
          x1="28"
          y1="5"
          x2="28"
          y2="35"
          stroke={resolveMarkFill(variant, gradId)}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* H crossbar */}
        <line
          x1="12"
          y1="20"
          x2="28"
          y2="20"
          stroke={resolveMarkFill(variant, gradId)}
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Boundary nodes — where H pillars touch the ring */}
        <circle
          cx="12"
          cy="5"
          r="2.5"
          fill={resolveMarkFill(variant, gradId)}
        />
        <circle
          cx="12"
          cy="35"
          r="2.5"
          fill={resolveMarkFill(variant, gradId)}
        />
        <circle
          cx="28"
          cy="5"
          r="2.5"
          fill={resolveMarkFill(variant, gradId)}
        />
        <circle
          cx="28"
          cy="35"
          r="2.5"
          fill={resolveMarkFill(variant, gradId)}
        />
        {/* Junction nodes — crossbar connections */}
        <circle cx="12" cy="20" r="2" fill={resolveMarkFill(variant, gradId)} />
        <circle cx="28" cy="20" r="2" fill={resolveMarkFill(variant, gradId)} />
      </svg>
    );
  },
);
HkiMark.displayName = "HkiMark";

// ─── HkiWordmark ──────────────────────────────────────────────────────────────

export interface HkiWordmarkProps extends React.SVGProps<SVGSVGElement> {
  /** Render the "PLATFORM" subtitle line (default: true) */
  subtitle?: boolean;
  /** Height in px — width scales proportionally (default: 28) */
  height?: number;
  variant?: BrandVariant;
}

/**
 * "HKI / PLATFORM" text-only wordmark. Combine with HkiMark or use solo.
 */
export const HkiWordmark = React.forwardRef<SVGSVGElement, HkiWordmarkProps>(
  (
    { subtitle = true, height = 28, variant = "color", className, ...props },
    ref,
  ) => {
    const vw = subtitle ? 198 : 66;
    const vh = subtitle ? 36 : 28;
    const w = Math.round((vw / vh) * height);
    const uid = React.useId().replace(/:/g, "");
    const gradId = `hki-wg-${uid}`;
    const { title: titleFill, sub: subFill } = resolveTextFill(variant);
    const useGrad = variant === "color" || variant === "color-dark";
    const isDark = variant === "color-dark";

    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${vw} ${vh}`}
        width={w}
        height={height}
        aria-label={subtitle ? "HKI — Hermetic Knowledge Isolation" : "HKI"}
        role="img"
        className={cn("shrink-0 select-none", className)}
        {...props}
      >
        {useGrad && (
          <defs>
            <linearGradient
              id={gradId}
              x1="0"
              y1="0"
              x2={vw}
              y2={vh}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor={isDark ? IRIS_LIGHT : IRIS} />
              <stop offset="65%" stopColor={isDark ? IRIS_LIGHT : IRIS} />
              <stop offset="100%" stopColor={isDark ? PULSE_LIGHT : PULSE} />
            </linearGradient>
          </defs>
        )}
        <text
          x="0"
          y="24"
          fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          fontWeight="700"
          fontSize="24"
          letterSpacing="-0.03em"
          fill={useGrad ? `url(#${gradId})` : titleFill}
        >
          HKI
        </text>
        {subtitle && (
          <text
            x="1"
            y="35"
            fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
            fontWeight="400"
            fontSize="9"
            letterSpacing="0.12em"
            fill={subFill}
          >
            HERMETIC KNOWLEDGE ISOLATION
          </text>
        )}
      </svg>
    );
  },
);
HkiWordmark.displayName = "HkiWordmark";

// ─── HkiLogo ─────────────────────────────────────────────────────────────────

export interface HkiLogoProps {
  /** Named size step or px number for the H mark (default: "md" = 32px) */
  size?: MarkSize | number;
  variant?: BrandVariant;
  /** Horizontal: mark left, text right. Stacked: mark above, text below. */
  layout?: LogoLayout;
  /** Show "PLATFORM" subtitle (default: true) */
  subtitle?: boolean;
  className?: string;
}

/**
 * Full HKI brand lockup — H mark + wordmark.
 * Composable: pass className for spacing/positioning.
 */
export const HkiLogo = React.forwardRef<HTMLDivElement, HkiLogoProps>(
  (
    {
      size = "md",
      variant = "color",
      layout = "horizontal",
      subtitle = true,
      className,
    },
    ref,
  ) => {
    const markPx = typeof size === "number" ? size : MARK_PX[size];
    const textH =
      layout === "horizontal"
        ? Math.round(markPx * 0.8)
        : Math.round(markPx * 0.65);

    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center",
          layout === "horizontal"
            ? "flex-row gap-3"
            : "flex-col items-start gap-2",
          className,
        )}
      >
        <HkiMark size={markPx} variant={variant} />
        <HkiWordmark height={textH} subtitle={subtitle} variant={variant} />
      </div>
    );
  },
);
HkiLogo.displayName = "HkiLogo";

// ─── Backward-compat aliases ─────────────────────────────────────────────────

/** @deprecated Use HkiMark */
export const HkiIcon = HkiMark;
export type HkiIconProps = HkiMarkProps;

/** @deprecated Use HkiLogo */
export const HkiInnovationLogo = HkiLogo;

/** @deprecated Use HkiMark */
export const HkiInnovationIcon = HkiMark;

/** @deprecated Use HkiLogo */
export const Logo = HkiLogo;

/** @deprecated Use HkiMark */
export const Icon = HkiMark;

export const Branding = {
  Mark: HkiMark,
  Wordmark: HkiWordmark,
  Logo: HkiLogo,
  /** @deprecated */
  Icon: HkiMark,
  /** @deprecated */
  HkiIcon: HkiMark,
} as const;
