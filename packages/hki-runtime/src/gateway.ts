import type {
  HkiEnvelope,
  HkiGatewayDecision,
  HkiGatewayTarget,
} from "./types";
import { isForbiddenRuntimeDomain, sameDomain } from "./domain";

const SCOPE_ARGUMENT_KEYS = [
  "scope",
  "domain",
  "active_domain",
  "activeDomain",
  "stream",
  "stream_id",
] as const;

export function evaluateGatewayTarget(
  envelope: HkiEnvelope,
  target: HkiGatewayTarget
): HkiGatewayDecision {
  if (isForbiddenRuntimeDomain(target.domain)) {
    return {
      allowed: false,
      reason: "target domain is global or wildcard",
      target,
    };
  }

  if (target.published_domains?.some(isForbiddenRuntimeDomain)) {
    return {
      allowed: false,
      reason: "target published_domains include global or wildcard scope",
      target,
    };
  }

  const isDirectDomainMatch = sameDomain(envelope.active_domain, target.domain);
  const isPublishedIntoDomain =
    target.published_domains?.some(domain =>
      sameDomain(domain, envelope.active_domain)
    ) ?? false;

  if (!isDirectDomainMatch && !isPublishedIntoDomain) {
    return {
      allowed: false,
      reason:
        "target is not in active domain and is not published into active domain",
      target,
    };
  }

  return {
    allowed: true,
    reason: "target is bound to active domain",
    target,
  };
}

export function rejectConflictingScopeArgument(
  envelope: HkiEnvelope,
  args: Record<string, unknown>
): string | null {
  for (const key of SCOPE_ARGUMENT_KEYS) {
    if (!Object.hasOwn(args, key)) continue;

    const values = normalizeScopeArgumentValues(args[key]);
    if (!values) {
      return `${key} is ambiguous and cannot override signed HKI active_domain`;
    }

    if (values.some(value => !sameDomain(value, envelope.active_domain))) {
      return `${key} conflicts with signed HKI active_domain`;
    }
  }

  return null;
}

function normalizeScopeArgumentValues(value: unknown): string[] | null {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized ? [normalized] : null;
  }

  if (!Array.isArray(value)) return null;

  const normalizedValues: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") return null;
    const normalized = item.trim();
    if (!normalized) return null;
    normalizedValues.push(normalized);
  }

  return normalizedValues.length > 0 ? normalizedValues : null;
}
