/**
 * Search Params Hook
 * Manages URL search params for task/agent selection
 * Uses wouter for routing (not react-router-dom)
 */

import { useCallback, useMemo } from "react";
import { useLocation, useSearch } from "wouter";

export enum SearchParamKey {
  TASK_ID = "taskId",
  AGENT_NAME = "agent",
  SCOPE = "scope",
}

export function useSafeSearchParams() {
  const [location, setLocation] = useLocation();
  const searchString = useSearch();

  const searchParams = useMemo(
    () => new URLSearchParams(searchString),
    [searchString]
  );

  const taskID = useMemo(
    () => searchParams.get(SearchParamKey.TASK_ID) || null,
    [searchParams]
  );

  const agentName = useMemo(
    () => searchParams.get(SearchParamKey.AGENT_NAME) || null,
    [searchParams]
  );

  const updateParams = useCallback(
    (updates: Partial<Record<SearchParamKey, string | null>>) => {
      const next = new URLSearchParams(searchParams);

      for (const [key, value] of Object.entries(updates)) {
        if (value === null) {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      }

      const queryString = next.toString();
      const basePath = location.split("?")[0];
      setLocation(queryString ? `${basePath}?${queryString}` : basePath);
    },
    [searchParams, location, setLocation]
  );

  return {
    taskID,
    agentName,
    updateParams,
    searchParams,
  };
}
