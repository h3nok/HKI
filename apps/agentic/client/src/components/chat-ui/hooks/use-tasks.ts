/**
 * Tasks Hook - Agentic tRPC adapter
 * Provides Agentex-compatible interface for conversations/tasks
 */

import { useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { agenticConversationToTask } from "../adapters/agentic-adapter";
import type { Task } from "../types";

/**
 * Hook to fetch all tasks (conversations)
 */
export function useTasks(userId: number) {
  const query = trpc.chat.getTasks.useQuery({ userId });

  const tasks = useMemo<Task[]>(() => {
    if (!query.data) return [];
    return query.data.map(agenticConversationToTask);
  }, [query.data]);

  return {
    data: tasks,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook to create a new task (conversation)
 */
export function useCreateTask(userId: number) {
  const utils = trpc.useUtils();

  const createMutation = trpc.chat.createTask.useMutation({
    onSuccess: () => {
      utils.chat.getTasks.invalidate({ userId });
    },
  });

  const createTask = useCallback(
    async (params: {
      description?: string;
      content?: string;
      projectId?: string; // Auto-assign to project (inherits active context)
      scope?: string; // Active domain scope
    }) => {
      const result = await createMutation.mutateAsync({
        userId,
        title: params.description,
        ...(params.projectId ? { projectId: params.projectId } : {}),
        ...(params.scope ? { scope: params.scope } : {}),
      });

      return {
        id: result.id,
        agent_name: "agentic-agent",
        status: "pending" as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    },
    [createMutation, userId]
  );

  return {
    createTask,
    isLoading: createMutation.isPending,
    isError: createMutation.isError,
    error: createMutation.error,
  };
}

/**
 * Hook to delete a task (conversation)
 */
export function useDeleteTask(userId: number) {
  const utils = trpc.useUtils();

  const deleteMutation = trpc.chat.deleteTask.useMutation({
    onSuccess: () => {
      utils.chat.getTasks.invalidate({ userId });
    },
  });

  const deleteTask = useCallback(
    async (taskId: string) => {
      await deleteMutation.mutateAsync({ conversationId: taskId });
      return { success: true };
    },
    [deleteMutation]
  );

  return {
    deleteTask,
    isLoading: deleteMutation.isPending,
    isError: deleteMutation.isError,
    error: deleteMutation.error,
  };
}

/**
 * Hook to rename a task (conversation)
 */
export function useRenameTask(userId: number) {
  const utils = trpc.useUtils();

  const renameMutation = trpc.chat.renameTask.useMutation({
    onSuccess: () => {
      utils.chat.getTasks.invalidate({ userId });
    },
  });

  const renameTask = useCallback(
    async (taskId: string, title: string) => {
      await renameMutation.mutateAsync({ conversationId: taskId, title });
      return { success: true };
    },
    [renameMutation]
  );

  return {
    renameTask,
    isLoading: renameMutation.isPending,
  };
}

/**
 * Hook to pin/unpin a task (conversation)
 */
export function usePinTask(userId: number) {
  const utils = trpc.useUtils();

  const pinMutation = trpc.chat.pinTask.useMutation({
    onSuccess: () => {
      utils.chat.getTasks.invalidate({ userId });
    },
  });

  const pinTask = useCallback(
    async (taskId: string, isPinned: boolean) => {
      await pinMutation.mutateAsync({ conversationId: taskId, isPinned });
      return { success: true };
    },
    [pinMutation]
  );

  return {
    pinTask,
    isLoading: pinMutation.isPending,
  };
}
