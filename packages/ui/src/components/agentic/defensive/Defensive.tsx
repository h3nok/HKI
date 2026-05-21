"use client";

/**
 * HKI Defensive UI Primitives
 *
 * The visual contract that makes HKI guarantees legible at runtime.
 * Every primitive in this module exists to remove ambiguity about scope,
 * never to decorate it.
 *
 *   <ScopeBadge />         Persistent active-domain identity (with lock + plane)
 *   <DomainStripe />       2px sticky top strip in plane color — the "you are here"
 *   <EnvelopeTtl />        Countdown chip; turns admin/coral when expiring
 *   <FailClosedState />    Verbatim deny reason. Never a generic "Error".
 *   <DomainFootprint />    Per-message footer: domain + trace id + audit link
 *   <CrossDomainGuard />   Inline confirm before any cross-plane action
 *   <AuditPill />          Opens trace/audit deeplink
 *
 * Design rules enforced by this module:
 *   1. Scope is always visible — never inferred, never hidden behind a popover.
 *   2. Fail-closed reasons are shown verbatim with stable error codes.
 *   3. Cross-plane actions require an explicit confirmation step.
 *   4. Locked scope (URL-pinned) is rendered with a Lock glyph + tooltip.
 *   5. Pending scope ("Resolving…") is its own state — not an empty render.
 *   6. Plane tone (runtime/publication/admin) is consistent across all surfaces.
 */

import * as React from "react";
import {
  Lock,
  Shield,
  ShieldOff,
  AlertOctagon,
  Hash,
  ExternalLink,
  Clock,
  ArrowRightLeft,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { cn } from "../../../utils";
import type { HkiPlane } from "../../signature";

/* ────────────────────────────────────────────────────────────────────────
 * ScopeBadge — persistent identity of the active domain
 * ──────────────────────────────────────────────────────────────────────── */

export interface ScopeBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Display name of the active domain (e.g. "payments"). */
  domain: string | null | undefined;
  /** Which plane this surface operates on. */
  plane?: HkiPlane;
  /** When true, the URL/admin pinned this scope — show a lock glyph. */
  locked?: boolean;
  /** Show a "Resolving…" state when domain is being looked up. */
  pending?: boolean;
  /** Variant: chip in chrome vs full-width banner */
  variant?: "chip" | "banner";
  /** Optional secondary label (e.g. "EU residency", "Tier 3"). */
  secondary?: React.ReactNode;
}

export const ScopeBadge = React.forwardRef<HTMLDivElement, ScopeBadgeProps>(
  (
    {
      className,
      domain,
      plane = "runtime",
      locked = false,
      pending = false,
      variant = "chip",
      secondary,
      ...props
    },
    ref
  ) => {
    const planeClass = `plane-chip--${plane}`;
    const label = pending ? "Resolving scope…" : (domain ?? "no scope");
    const isUnscoped =
      !pending && (!domain || domain === "global" || domain === "*");

    if (variant === "banner") {
      return (
        <div
          ref={ref}
          role="status"
          aria-live="polite"
          className={cn(
            "flex w-full items-center gap-3 px-4 py-2 text-xs",
            "hairline-bottom",
            "surface-stamped",
            `surface-stamped--${plane}`,
            className
          )}
          {...props}
        >
          <span className={cn("plane-chip", planeClass)}>
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            {plane}
          </span>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--text-secondary)]">
              Active domain
            </span>
            <span
              className={cn(
                "truncate font-mono text-[0.78rem] tracking-[-0.01em]",
                isUnscoped
                  ? "text-[color:var(--plane-admin)]"
                  : "text-[color:var(--foreground)]"
              )}
            >
              {label}
            </span>
            {locked && (
              <Lock
                className="h-3 w-3 shrink-0 text-[color:var(--text-muted)]"
                aria-label="Scope is locked by URL or admin policy"
              />
            )}
          </div>
          {secondary ? (
            <span className="text-[11px] text-[color:var(--text-secondary)]">
              {secondary}
            </span>
          ) : null}
        </div>
      );
    }

    return (
      <div
        ref={ref}
        role="status"
        aria-live="polite"
        className={cn(
          "plane-chip",
          planeClass,
          isUnscoped && "plane-chip--admin",
          className
        )}
        title={
          pending
            ? "Resolving active domain…"
            : isUnscoped
              ? "No active domain — fail-closed"
              : `Active domain: ${domain}${locked ? " (locked)" : ""}`
        }
        {...props}
      >
        {pending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : locked ? (
          <Lock className="h-3 w-3" />
        ) : null}
        <span className="font-mono normal-case tracking-[-0.01em]">
          {label}
        </span>
        {secondary ? (
          <span className="ml-1 opacity-70">{secondary}</span>
        ) : null}
      </div>
    );
  }
);
ScopeBadge.displayName = "ScopeBadge";

/* ────────────────────────────────────────────────────────────────────────
 * DomainStripe — 2px sticky plane indicator at top of viewport / surface
 * ──────────────────────────────────────────────────────────────────────── */

export interface DomainStripeProps extends React.HTMLAttributes<HTMLDivElement> {
  plane?: HkiPlane;
  /** When true, also show the eyebrow text overlay. */
  withLabel?: boolean;
  label?: React.ReactNode;
}

export const DomainStripe = React.forwardRef<HTMLDivElement, DomainStripeProps>(
  (
    { className, plane = "runtime", withLabel = false, label, ...props },
    ref
  ) => (
    <div
      ref={ref}
      aria-hidden={!withLabel}
      className={cn("relative w-full", className)}
      {...props}
    >
      <div
        className="h-[2px] w-full"
        style={{ background: `var(--plane-${plane})` }}
      />
      {withLabel && (
        <div className="absolute right-3 top-1.5">
          <span className={cn("eyebrow eyebrow--brand")}>{label ?? plane}</span>
        </div>
      )}
    </div>
  )
);
DomainStripe.displayName = "DomainStripe";

/* ────────────────────────────────────────────────────────────────────────
 * EnvelopeTtl — countdown chip; turns admin/coral when expiring
 * ──────────────────────────────────────────────────────────────────────── */

export interface EnvelopeTtlProps extends Omit<
  React.HTMLAttributes<HTMLSpanElement>,
  "children"
> {
  /** Unix seconds when the envelope expires. */
  expiresAt: number;
  /** Threshold (seconds) under which the chip flips to admin/coral. */
  warnSeconds?: number;
  /** Callback fired once when remaining drops to 0. */
  onExpired?: () => void;
}

function formatSecondsLeft(secondsLeft: number) {
  if (secondsLeft <= 0) return "expired";
  if (secondsLeft < 60) return `${secondsLeft}s`;
  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}

export const EnvelopeTtl = React.forwardRef<HTMLSpanElement, EnvelopeTtlProps>(
  ({ className, expiresAt, warnSeconds = 30, onExpired, ...props }, ref) => {
    const [now, setNow] = React.useState(() => Math.floor(Date.now() / 1000));
    const firedRef = React.useRef(false);

    React.useEffect(() => {
      const id = window.setInterval(() => {
        setNow(Math.floor(Date.now() / 1000));
      }, 1000);
      return () => window.clearInterval(id);
    }, []);

    const left = Math.max(0, expiresAt - now);
    const isExpired = left <= 0;
    const isWarning = !isExpired && left <= warnSeconds;

    React.useEffect(() => {
      if (isExpired && !firedRef.current) {
        firedRef.current = true;
        onExpired?.();
      }
    }, [isExpired, onExpired]);

    return (
      <span
        ref={ref}
        role="timer"
        aria-live={isWarning ? "polite" : "off"}
        className={cn(
          "plane-chip",
          isExpired || isWarning ? "plane-chip--admin" : "plane-chip--runtime",
          className
        )}
        title={
          isExpired
            ? "Envelope expired — request will fail closed"
            : `Envelope expires in ${formatSecondsLeft(left)}`
        }
        {...props}
      >
        <Clock className="h-3 w-3" />
        <span className="font-mono normal-case tracking-[-0.01em]">
          {formatSecondsLeft(left)}
        </span>
      </span>
    );
  }
);
EnvelopeTtl.displayName = "EnvelopeTtl";

/* ────────────────────────────────────────────────────────────────────────
 * FailClosedState — verbatim deny reason
 * ──────────────────────────────────────────────────────────────────────── */

export type FailClosedKind =
  | "missing-envelope"
  | "unauthorized-domain"
  | "scope-override"
  | "expired-envelope"
  | "artifact-out-of-scope"
  | "cross-domain-blocked"
  | "tool-blocked"
  | "unknown";

const FAIL_CLOSED_META: Record<
  FailClosedKind,
  { title: string; hint: string; icon: React.ElementType }
> = {
  "missing-envelope": {
    title: "Missing envelope",
    hint: "This surface requires a signed HKI envelope. Sign in or refresh the page to mint one.",
    icon: ShieldOff,
  },
  "unauthorized-domain": {
    title: "Unauthorized domain",
    hint: "Your active envelope is not authorized for this domain. Switch scope or request access.",
    icon: Shield,
  },
  "scope-override": {
    title: "Scope override blocked",
    hint: "The request body attempted to override the active domain. The gateway rejected it.",
    icon: AlertOctagon,
  },
  "expired-envelope": {
    title: "Envelope expired",
    hint: "The signed envelope has expired. Re-authenticate to mint a new one.",
    icon: Clock,
  },
  "artifact-out-of-scope": {
    title: "Artifact outside active domain",
    hint: "The requested artifact lives in a different domain. Cross-domain reads require explicit publication.",
    icon: Shield,
  },
  "cross-domain-blocked": {
    title: "Cross-domain access blocked",
    hint: "This action would cross domains. Publish explicitly through the admin plane, or narrow scope.",
    icon: ShieldOff,
  },
  "tool-blocked": {
    title: "Tool blocked by gateway",
    hint: "The MCP gateway evaluated the tool target and denied it. Check tool scope and policy pack.",
    icon: AlertOctagon,
  },
  unknown: {
    title: "Request denied",
    hint: "The runtime rejected this request. See the reason below.",
    icon: AlertOctagon,
  },
};

export interface FailClosedStateProps extends React.HTMLAttributes<HTMLDivElement> {
  kind?: FailClosedKind;
  /** Stable error code from the runtime (e.g. "scope-override"). Rendered verbatim. */
  code: string;
  /** Optional verbatim reason string from the runtime — shown without rewriting. */
  reason?: string;
  /** Domain in play, when known. */
  domain?: string | null;
  /** Trace / request ID to enable support follow-up. */
  traceId?: string;
  /** Optional action (retry, re-auth, switch scope). */
  action?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

export const FailClosedState = React.forwardRef<
  HTMLDivElement,
  FailClosedStateProps
>(
  (
    {
      className,
      kind = "unknown",
      code,
      reason,
      domain,
      traceId,
      action,
      size = "md",
      ...props
    },
    ref
  ) => {
    const meta = FAIL_CLOSED_META[kind];
    const Icon = meta.icon;
    const padding = size === "sm" ? "p-4" : size === "lg" ? "p-8" : "p-6";

    return (
      <div
        ref={ref}
        role="alert"
        aria-live="assertive"
        className={cn(
          "surface-stamped surface-stamped--admin",
          "flex flex-col gap-3",
          padding,
          className
        )}
        {...props}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{
              background: "var(--plane-admin-muted)",
              border: "1px solid var(--plane-admin-border)",
              color: "var(--plane-admin)",
            }}
            aria-hidden
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="eyebrow eyebrow--brand">Fail-closed · {code}</p>
            <h3 className="text-display mt-1 text-[1.05rem] leading-tight text-[color:var(--foreground)]">
              {meta.title}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-[color:var(--text-secondary)]">
              {meta.hint}
            </p>
          </div>
        </div>

        {reason ? (
          <pre
            className={cn(
              "text-mono-precise",
              "whitespace-pre-wrap break-words rounded-md border p-3 text-[11px] leading-snug"
            )}
            style={{
              background: "var(--muted)",
              borderColor: "var(--hairline)",
              color: "var(--text-body)",
            }}
          >
            {reason}
          </pre>
        ) : null}

        {(domain || traceId) && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {domain ? <ScopeBadge domain={domain} plane="runtime" /> : null}
            {traceId ? <AuditPill traceId={traceId} /> : null}
          </div>
        )}

        {action ? <div className="pt-1">{action}</div> : null}
      </div>
    );
  }
);
FailClosedState.displayName = "FailClosedState";

/* ────────────────────────────────────────────────────────────────────────
 * DomainFootprint — per-message footer (domain + trace + audit)
 * ──────────────────────────────────────────────────────────────────────── */

export interface DomainFootprintProps extends React.HTMLAttributes<HTMLDivElement> {
  domain: string | null | undefined;
  plane?: HkiPlane;
  traceId?: string;
  auditHref?: string;
  policyPackId?: string;
}

export const DomainFootprint = React.forwardRef<
  HTMLDivElement,
  DomainFootprintProps
>(
  (
    {
      className,
      domain,
      plane = "runtime",
      traceId,
      auditHref,
      policyPackId,
      ...props
    },
    ref
  ) => (
    <div
      ref={ref}
      className={cn(
        "hairline-top flex flex-wrap items-center gap-2 pt-2 text-[11px]",
        className
      )}
      {...props}
    >
      <ScopeBadge domain={domain} plane={plane} />
      {policyPackId ? (
        <span
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-[color:var(--text-muted)]"
          style={{
            background: "var(--muted)",
            border: "1px solid var(--hairline)",
          }}
        >
          <Shield className="h-3 w-3" />
          {policyPackId}
        </span>
      ) : null}
      {traceId ? (
        auditHref ? (
          <AuditPill traceId={traceId} href={auditHref} />
        ) : (
          <AuditPill traceId={traceId} />
        )
      ) : null}
    </div>
  )
);
DomainFootprint.displayName = "DomainFootprint";

/* ────────────────────────────────────────────────────────────────────────
 * CrossDomainGuard — inline confirm before any cross-plane action
 * ──────────────────────────────────────────────────────────────────────── */

export interface CrossDomainGuardProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "onChange"
> {
  /** Domain the user is currently scoped to. */
  fromDomain: string;
  /** Target domain the action would touch. */
  toDomain: string;
  /** Plain-language summary of what the action does. */
  intent: string;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}

export const CrossDomainGuard = React.forwardRef<
  HTMLDivElement,
  CrossDomainGuardProps
>(
  (
    {
      className,
      fromDomain,
      toDomain,
      intent,
      onConfirm,
      onCancel,
      confirmLabel = "Confirm cross-domain action",
      cancelLabel = "Cancel",
      ...props
    },
    ref
  ) => (
    <div
      ref={ref}
      role="alertdialog"
      aria-modal={false}
      className={cn(
        "surface-stamped surface-stamped--publication",
        "flex flex-col gap-3 p-4",
        className
      )}
      {...props}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{
            background: "var(--plane-publication-muted)",
            border: "1px solid var(--plane-publication-border)",
            color: "var(--plane-publication)",
          }}
          aria-hidden
        >
          <ArrowRightLeft className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="eyebrow eyebrow--brand">Cross-domain action</p>
          <p className="mt-1 text-sm leading-relaxed text-[color:var(--foreground)]">
            {intent}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
            <ScopeBadge domain={fromDomain} plane="runtime" />
            <ArrowRightLeft
              className="h-3 w-3 text-[color:var(--text-muted)]"
              aria-hidden
            />
            <ScopeBadge domain={toDomain} plane="publication" />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="signature-focus inline-flex h-8 items-center gap-1.5 rounded-md border border-[color:var(--hairline-strong)] bg-[color:var(--card)] px-3 text-xs font-medium text-[color:var(--foreground)] hover:border-[color:var(--hairline-brand)]"
          >
            <X className="h-3.5 w-3.5" />
            {cancelLabel}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onConfirm}
          className="signature-focus inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold"
          style={{
            background: "var(--plane-publication)",
            color: "var(--plane-publication-fg)",
          }}
        >
          <Check className="h-3.5 w-3.5" />
          {confirmLabel}
        </button>
      </div>
    </div>
  )
);
CrossDomainGuard.displayName = "CrossDomainGuard";

/* ────────────────────────────────────────────────────────────────────────
 * AuditPill — opens audit deeplink for a trace ID
 * ──────────────────────────────────────────────────────────────────────── */

export interface AuditPillProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  traceId: string;
  /** Optional href to the audit explorer. Falls back to a no-op span when missing. */
  href?: string;
}

export const AuditPill = React.forwardRef<HTMLAnchorElement, AuditPillProps>(
  ({ className, traceId, href, ...props }, ref) => {
    const short =
      traceId.length > 12
        ? `${traceId.slice(0, 6)}…${traceId.slice(-4)}`
        : traceId;
    const baseClass = cn(
      "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
      "text-mono-precise",
      "text-[color:var(--text-secondary)] hover:text-[color:var(--primary)]",
      "border border-[color:var(--hairline)]",
      "signature-focus",
      className
    );

    const content = (
      <>
        <Hash className="h-3 w-3" />
        <span>{short}</span>
        {href ? <ExternalLink className="h-3 w-3 opacity-60" /> : null}
      </>
    );

    if (href) {
      return (
        <a
          ref={ref}
          href={href}
          target="_blank"
          rel="noreferrer"
          className={baseClass}
          title={`Trace ${traceId} — open audit log`}
          {...props}
        >
          {content}
        </a>
      );
    }

    return (
      <span
        // anchorless variant for when no audit URL is wired yet
        className={baseClass}
        title={`Trace ${traceId}`}
      >
        {content}
      </span>
    );
  }
);
AuditPill.displayName = "AuditPill";
