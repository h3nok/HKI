"use client";

/**
 * HKI Signature Primitives
 *
 * Opt-in, additive React primitives that consume the signature.css utility
 * layer. Apps adopt these progressively — nothing here replaces existing
 * components.
 *
 *   <Eyebrow />          uppercase tracked label (with optional rule)
 *   <DisplayHeading />   editorial display headline (Plus Jakarta Sans)
 *   <EditorialAccent />  italic Instrument Serif inline accent
 *   <Hairline />         precision 1px rule (full or brand-tinted)
 *   <PlaneChip />        runtime / publication / admin pill
 *   <StampedCard />      card with top accent rail + inset highlight
 *   <PrecisionCard />    same depth, no accent rail
 *
 * All primitives are theme-aware (light + dark) and respect
 * `prefers-reduced-motion`.
 */

import * as React from "react";
import { cn } from "../utils";

export type HkiPlane = "runtime" | "publication" | "admin";

/* ── Eyebrow ─────────────────────────────────────────────────────────── */

export interface EyebrowProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: "default" | "brand";
  rule?: boolean;
}

export const Eyebrow = React.forwardRef<HTMLSpanElement, EyebrowProps>(
  ({ className, tone = "default", rule = false, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "eyebrow",
        tone === "brand" && "eyebrow--brand",
        rule && "eyebrow--rule",
        className
      )}
      {...props}
    />
  )
);
Eyebrow.displayName = "Eyebrow";

/* ── DisplayHeading ─────────────────────────────────────────────────── */

type Level = 1 | 2 | 3 | 4;

export interface DisplayHeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: `h${Level}`;
  weight?: "default" | "tight";
}

export const DisplayHeading = React.forwardRef<
  HTMLHeadingElement,
  DisplayHeadingProps
>(({ as: Tag = "h2", weight = "default", className, ...props }, ref) => {
  return React.createElement(Tag, {
    ref,
    className: cn(
      weight === "tight" ? "text-display-tight" : "text-display",
      className
    ),
    ...props,
  });
});
DisplayHeading.displayName = "DisplayHeading";

/* ── EditorialAccent ────────────────────────────────────────────────── */

export const EditorialAccent = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span ref={ref} className={cn("text-editorial", className)} {...props} />
));
EditorialAccent.displayName = "EditorialAccent";

/* ── Hairline ───────────────────────────────────────────────────────── */

export interface HairlineProps extends React.HTMLAttributes<HTMLHRElement> {
  tone?: "default" | "brand";
}

export const Hairline = React.forwardRef<HTMLHRElement, HairlineProps>(
  ({ className, tone = "default", ...props }, ref) => (
    <hr
      ref={ref}
      className={cn(
        "hairline-rule",
        tone === "brand" && "hairline-rule--brand",
        className
      )}
      {...props}
    />
  )
);
Hairline.displayName = "Hairline";

/* ── PlaneChip ──────────────────────────────────────────────────────── */

export interface PlaneChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  plane: HkiPlane;
  variant?: "subtle" | "solid";
  label?: string;
}

const PLANE_LABEL: Record<HkiPlane, string> = {
  runtime: "Runtime",
  publication: "Publication",
  admin: "Admin",
};

export const PlaneChip = React.forwardRef<HTMLSpanElement, PlaneChipProps>(
  (
    { className, plane, variant = "subtle", label, children, ...props },
    ref
  ) => (
    <span
      ref={ref}
      className={cn(
        "plane-chip",
        `plane-chip--${plane}`,
        variant === "solid" && "plane-chip--solid",
        className
      )}
      {...props}
    >
      {children ?? label ?? PLANE_LABEL[plane]}
    </span>
  )
);
PlaneChip.displayName = "PlaneChip";

/* ── PrecisionCard ──────────────────────────────────────────────────── */

export const PrecisionCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("surface-precision", className)} {...props} />
));
PrecisionCard.displayName = "PrecisionCard";

/* ── StampedCard ────────────────────────────────────────────────────── */

export interface StampedCardProps extends React.HTMLAttributes<HTMLDivElement> {
  plane?: HkiPlane;
}

export const StampedCard = React.forwardRef<HTMLDivElement, StampedCardProps>(
  ({ className, plane, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "surface-stamped",
        plane && `surface-stamped--${plane}`,
        className
      )}
      {...props}
    />
  )
);
StampedCard.displayName = "StampedCard";
