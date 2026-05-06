/**
 * Spans Hook - Agentic tRPC adapter
 * Provides Agentex-compatible interface for thought traces/spans
 */

import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { agenticThoughtTraceToSpans } from "../adapters/agentic-adapter";
import type { Span } from "../types";

/**
 * Hook to fetch spans (thought trace steps) for a message
 * Note: Agentic's getThoughtTrace requires messageId, not conversationId
 */
export function useSpans(messageId: string | null, taskId?: string | null) {
  const query = trpc.chat.getThoughtTrace.useQuery(
    { messageId: messageId! },
    {
      enabled: !!messageId,
      refetchOnWindowFocus: false,
    }
  );

  const spans = useMemo<Span[]>(() => {
    if (!query.data || !messageId) return [];
    return agenticThoughtTraceToSpans(query.data as any, taskId || messageId);
  }, [query.data, messageId, taskId]);

  return {
    spans,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error ? String(query.error) : null,
    refetch: query.refetch,
  };
}
