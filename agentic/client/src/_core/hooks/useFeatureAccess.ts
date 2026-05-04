import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  createFeatureFlagSnapshot,
  type FeatureFlagKey,
} from "@shared/feature-flags";

const EMPTY_FLAGS = createFeatureFlagSnapshot(false);

export function useFeatureAccess() {
  const viewerContextQuery = trpc.auth.viewerContext.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const flags = viewerContextQuery.data?.flags ?? EMPTY_FLAGS;

  return useMemo(
    () => ({
      flags,
      isLoading: viewerContextQuery.isLoading,
      isReady: !viewerContextQuery.isLoading,
      canView: (key: FeatureFlagKey) => Boolean(flags[key]),
      debugSession: viewerContextQuery.data?.debugSession ?? null,
      viewerContext: viewerContextQuery.data ?? null,
    }),
    [flags, viewerContextQuery.data, viewerContextQuery.isLoading]
  );
}
