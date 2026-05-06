import { GLOBAL_DOMAIN, WILDCARD_DOMAIN } from "./types";

export function normalizeDomain(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

export function isGlobalDomain(value: unknown): boolean {
  return normalizeDomain(value)?.toLowerCase() === GLOBAL_DOMAIN;
}

export function isWildcardDomain(value: unknown): boolean {
  return normalizeDomain(value) === WILDCARD_DOMAIN;
}

export function isForbiddenRuntimeDomain(value: unknown): boolean {
  return isGlobalDomain(value) || isWildcardDomain(value);
}

export function normalizeDomainList(
  values: readonly unknown[] | unknown
): string[] {
  const source = Array.isArray(values) ? values : [];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of source) {
    const domain = normalizeDomain(value);
    if (!domain) continue;
    const key = domain.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(domain);
  }

  return result;
}

export function sameDomain(a: unknown, b: unknown): boolean {
  const left = normalizeDomain(a);
  const right = normalizeDomain(b);
  return Boolean(left && right && left.toLowerCase() === right.toLowerCase());
}
