/**
 * useScope — Value-stream scope hook for the Agentic Platform.
 *
 * Fetches value streams from the database via tRPC (no hardcoded data).
 *
 * Scope determines:
 *  - Which quick action cards are visible
 *  - Which agents the orchestrator may invoke
 *  - Which data the backend returns
 *
 * Admins can switch to any stream. Other users see only assigned streams.
 * URL param ?scope=<id> is honoured on mount (e.g. from admin dashboard).
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import {
  GLOBAL_SCOPE,
  GLOBAL_SCOPE_DEF,
  type ValueStreamDef,
} from "@shared/value-streams";

/** Safely parse a JSON-encoded string[] from the DB sampleQuestions column */
function parseSampleQuestions(
  raw: string | null | undefined
): string[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((q: unknown) => typeof q === "string")
      : undefined;
  } catch {
    return undefined;
  }
}

export interface ScopeState {
  /** Currently active scope ID */
  activeScope: string;
  /** Set the active scope (must be one the user is allowed) */
  setActiveScope: (scopeId: string) => void;
  /** All scopes available to this user */
  availableScopes: ValueStreamDef[];
  /** The active scope definition */
  activeScopeDef: ValueStreamDef | undefined;
  /** True if the user has more than one scope to choose from */
  hasMultipleScopes: boolean;
  /** True when the URL forces chat into a specific non-global scope */
  isScopeLocked: boolean;
  /** True if active scope is global (no restrictions) */
  isGlobal: boolean;
}

export function useScope(): ScopeState {
  // Fetch value streams from DB (all authenticated users can call this)
  const streamsQ = trpc.scope.listStreams.useQuery(undefined, {
    staleTime: 60_000,
    retry: false,
  });

  // Build the full list: Global (built-in) + DB streams
  const allStreams = useMemo<ValueStreamDef[]>(() => {
    const dbStreams: ValueStreamDef[] = (streamsQ.data ?? [])
      .filter(s => s.id !== GLOBAL_SCOPE) // avoid duplicating the built-in global scope
      .map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        icon: s.icon,
        sampleQuestions: parseSampleQuestions(s.sampleQuestions),
      }));
    return [GLOBAL_SCOPE_DEF, ...dbStreams];
  }, [streamsQ.data]);

  // Server already RBAC-filters streams — allStreams IS the user's available set
  const availableScopes = allStreams;
  const assignedIds = useMemo(() => allStreams.map(vs => vs.id), [allStreams]);

  // Read ?scope= from URL on mount (e.g. /chat?scope=pharmacy from admin dashboard)
  const urlScope = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("scope");
  }, []);

  const [activeScope, setActiveScopeRaw] = useState<string>(GLOBAL_SCOPE);
  const isScopeLocked = useMemo(
    () =>
      !!urlScope && urlScope !== GLOBAL_SCOPE && assignedIds.includes(urlScope),
    [assignedIds, urlScope]
  );

  // Once streams load, apply URL param or default to first assigned
  useEffect(() => {
    if (assignedIds.length === 0) return;
    if (urlScope && assignedIds.includes(urlScope)) {
      setActiveScopeRaw(urlScope);
    } else if (!assignedIds.includes(activeScope)) {
      setActiveScopeRaw(assignedIds[0] || GLOBAL_SCOPE);
    }
  }, [assignedIds, urlScope]); // eslint-disable-line react-hooks/exhaustive-deps

  const setActiveScope = useCallback(
    (scopeId: string) => {
      if (isScopeLocked) return;
      if (assignedIds.includes(scopeId)) {
        setActiveScopeRaw(scopeId);
      }
    },
    [assignedIds, isScopeLocked]
  );

  const activeScopeDef = useMemo(
    () => allStreams.find(vs => vs.id === activeScope),
    [activeScope, allStreams]
  );

  return {
    activeScope,
    setActiveScope,
    availableScopes,
    activeScopeDef,
    hasMultipleScopes: availableScopes.length > 1,
    isScopeLocked,
    isGlobal: activeScope === GLOBAL_SCOPE,
  };
}
