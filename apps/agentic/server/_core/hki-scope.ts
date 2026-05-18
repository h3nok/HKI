export const GLOBAL_SCOPE = "global";

export const HKI_RUNTIME_SCOPE_ERROR =
  "[Auth] KB_HERMETIC_ISOLATION requires an explicit non-global downstream stream scope";

type RuntimeScopeInput = {
  scope?: string | null;
  scopes?: readonly (string | null | undefined)[] | null;
  hermetic?: boolean;
};

export type RuntimeScopeResolution = {
  scope: string;
  scopes: string[];
  streamId?: string;
};

export function normalizeScope(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function isGlobalScope(value?: string | null): boolean {
  return normalizeScope(value)?.toLowerCase() === GLOBAL_SCOPE;
}

export function isForbiddenRuntimeScope(value?: string | null): boolean {
  const normalized = normalizeScope(value)?.toLowerCase();
  return !normalized || normalized === GLOBAL_SCOPE || normalized === "*";
}

export function normalizeScopeList(
  scopes?: readonly (string | null | undefined)[] | null
): string[] {
  if (!scopes?.length) return [];

  const result: string[] = [];
  const seen = new Set<string>();

  for (const rawScope of scopes) {
    const normalizedScope = normalizeScope(rawScope);
    if (!normalizedScope) continue;

    const scopeKey = normalizedScope.toLowerCase();
    if (seen.has(scopeKey)) continue;

    seen.add(scopeKey);
    result.push(normalizedScope);
  }

  return result;
}

export function resolveRuntimeScope({
  scope,
  scopes,
  hermetic = false,
}: RuntimeScopeInput): RuntimeScopeResolution {
  const normalizedScopes = normalizeScopeList(scopes);
  const normalizedScope = normalizeScope(scope) ?? normalizedScopes[0] ?? null;

  if (normalizedScope) {
    const normalizedScopeKey = normalizedScope.toLowerCase();
    const remainingScopes = normalizedScopes.filter(
      candidate => candidate.toLowerCase() !== normalizedScopeKey
    );
    normalizedScopes.splice(0, normalizedScopes.length, normalizedScope);
    normalizedScopes.push(...remainingScopes);
  }

  const effectiveScope = normalizedScope ?? GLOBAL_SCOPE;
  const effectiveScopes =
    normalizedScopes.length > 0 ? normalizedScopes : [effectiveScope];

  if (
    hermetic &&
    (!normalizedScope ||
      isGlobalScope(normalizedScope) ||
      effectiveScopes.some(candidate => isGlobalScope(candidate)))
  ) {
    throw new Error(HKI_RUNTIME_SCOPE_ERROR);
  }

  return {
    scope: effectiveScope,
    scopes: effectiveScopes,
    streamId: isGlobalScope(effectiveScope) ? undefined : effectiveScope,
  };
}
