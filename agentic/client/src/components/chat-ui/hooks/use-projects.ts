/**
 * Projects Hooks — CRUD for conversation projects/folders
 */

import { useMemo, useCallback } from 'react';
import { trpc } from '@/lib/trpc';

export interface Project {
  id: string;
  name: string;
  emoji: string;
  color?: string | null;
}

/**
 * Hook to fetch all projects for the current user
 */
export function useProjects() {
  const query = trpc.projects.list.useQuery();

  const projects = useMemo<Project[]>(() => {
    if (!query.data) return [];
    return query.data.map((p) => ({
      id: p.id,
      name: p.name,
      emoji: p.emoji,
      color: p.color,
    }));
  }, [query.data]);

  return {
    data: projects,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}

/**
 * Hook to create a project
 */
export function useCreateProject() {
  const utils = trpc.useUtils();

  const createMutation = trpc.projects.create.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
    },
  });

  const createProject = useCallback(
    async (params: { name: string; emoji?: string; color?: string }) => {
      return createMutation.mutateAsync(params);
    },
    [createMutation]
  );

  return {
    createProject,
    isLoading: createMutation.isPending,
  };
}

/**
 * Hook to rename a project
 */
export function useRenameProject() {
  const utils = trpc.useUtils();

  const renameMutation = trpc.projects.rename.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
    },
  });

  const renameProject = useCallback(
    async (projectId: string, name: string) => {
      return renameMutation.mutateAsync({ projectId, name });
    },
    [renameMutation]
  );

  return {
    renameProject,
    isLoading: renameMutation.isPending,
  };
}

/**
 * Hook to delete a project (conversations are unlinked, not deleted)
 */
export function useDeleteProject() {
  const utils = trpc.useUtils();

  const deleteMutation = trpc.projects.delete.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
      utils.chat.getTasks.invalidate();
    },
  });

  const deleteProject = useCallback(
    async (projectId: string) => {
      return deleteMutation.mutateAsync({ projectId });
    },
    [deleteMutation]
  );

  return {
    deleteProject,
    isLoading: deleteMutation.isPending,
  };
}

/**
 * Hook to move a conversation into (or out of) a project
 */
export function useMoveConversation() {
  const utils = trpc.useUtils();

  const moveMutation = trpc.projects.moveConversation.useMutation({
    onSuccess: () => {
      utils.chat.getTasks.invalidate();
    },
  });

  const moveConversation = useCallback(
    async (conversationId: string, projectId: string | null) => {
      return moveMutation.mutateAsync({ conversationId, projectId });
    },
    [moveMutation]
  );

  return {
    moveConversation,
    isLoading: moveMutation.isPending,
  };
}
