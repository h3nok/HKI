/**
 * Task Messages Hook - Agentic tRPC adapter
 * Provides Agentex-compatible interface using Agentic's backend
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { agenticMessageToTaskMessage } from "../adapters/agentic-adapter";
import type { TaskMessage, TaskMessageContent, TextContent } from "../types";

export type TaskMessagesData = {
  conversation: {
    id: string;
    scope?: string | null;
    title?: string | null;
  } | null;
  messages: TaskMessage[];
  rpcStatus: "idle" | "pending" | "success" | "error";
};

export const taskMessagesKeys = {
  all: ["taskMessages"] as const,
  byTaskId: (taskId: string) => [...taskMessagesKeys.all, taskId] as const,
};

/**
 * Hook to fetch messages for a task
 */
export function useTaskMessages(taskId: string | null) {
  const query = trpc.chat.getTask.useQuery(
    { conversationId: taskId! },
    {
      enabled: !!taskId,
      refetchOnWindowFocus: false,
    }
  );

  const messages = useMemo<TaskMessage[]>(() => {
    if (!query.data?.messages) return [];

    // Convert Agentic messages to Agentex format
    const taskMessages: TaskMessage[] = [];
    for (const msg of query.data.messages) {
      const converted = agenticMessageToTaskMessage(msg as any);
      taskMessages.push(...converted);
    }
    return taskMessages;
  }, [query.data]);

  const data: TaskMessagesData = useMemo(
    () => ({
      conversation: query.data?.conversation
        ? {
            id: String((query.data.conversation as { id: string }).id),
            scope:
              (query.data.conversation as { scope?: string | null }).scope ??
              null,
            title:
              (query.data.conversation as { title?: string | null }).title ??
              null,
          }
        : null,
      messages,
      rpcStatus: query.isLoading
        ? "pending"
        : query.isError
          ? "error"
          : query.isSuccess
            ? "success"
            : "idle",
    }),
    [
      messages,
      query.data?.conversation,
      query.isLoading,
      query.isError,
      query.isSuccess,
    ]
  );

  return {
    data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

type SendMessageParams = {
  taskId: string;
  content: TaskMessageContent;
  scope?: string;
};

/**
 * Hook to send a message
 */
export function useSendMessage() {
  const utils = trpc.useUtils();
  const cancelledRef = useRef(false);
  const [wasCancelled, setWasCancelled] = useState(false);

  const sendMutation = trpc.chat.sendMessage.useMutation({
    // Optimistic Update
    onMutate: async newJoin => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await utils.chat.getTask.cancel({
        conversationId: newJoin.conversationId,
      });

      // Snapshot the previous value
      const previousData = utils.chat.getTask.getData({
        conversationId: newJoin.conversationId,
      });

      // Optimistically update to the new value — works for both existing AND new conversations
      const optimisticMessage = {
        id: `optimistic-${Date.now()}`,
        conversationId: newJoin.conversationId,
        role: "user" as const,
        content: newJoin.content,
        createdAt: new Date().toISOString(),
        thoughtTrace: null,
        toolCalls: null,
        citations: null,
        confidence: null,
        guardrails: null,
      };

      utils.chat.getTask.setData(
        { conversationId: newJoin.conversationId },
        old => {
          if (!old) return undefined;
          const nextMessages = [...(old.messages as any[]), optimisticMessage];
          return {
            ...old,
            messages: nextMessages,
          } as typeof old;
        }
      );

      // Return a context object with the snapshotted value
      return { previousData };
    },
    // If the mutation fails, use the context returned from onMutate to roll back
    onError: (_err, newJoin, context) => {
      if (context?.previousData) {
        utils.chat.getTask.setData(
          { conversationId: newJoin.conversationId },
          context.previousData
        );
      }
    },
    // Always refetch after error or success:
    onSettled: (_data, _error, variables) => {
      utils.chat.getTask.invalidate({
        conversationId: variables.conversationId,
      });
      // Also refresh the sidebar task list (new tasks, updated titles, message counts)
      utils.chat.getTasks.invalidate();
    },
  });

  const sendMessage = useCallback(
    async ({ taskId, content, scope }: SendMessageParams) => {
      // Extract text content
      let messageContent = "";
      if (content.type === "text") {
        messageContent = (content as TextContent).content;
      } else if (content.type === "data") {
        messageContent = JSON.stringify(content.data);
      }

      cancelledRef.current = false;
      setWasCancelled(false);

      try {
        const result = await sendMutation.mutateAsync({
          conversationId: taskId,
          content: messageContent,
          ...(scope ? { scope } : {}),
        });

        // If user cancelled during the await, don't return the result
        if (cancelledRef.current) return undefined;
        return result;
      } catch (err) {
        // Swallow if this was a user-initiated cancellation
        if (cancelledRef.current) return undefined;
        throw err;
      }
    },
    [sendMutation]
  );

  /**
   * Cancel the in-flight send.
   * Resets mutation state so the UI immediately reflects cancellation.
   * Note: the server may still finish processing — this is client-side only.
   */
  const cancelSend = useCallback(() => {
    cancelledRef.current = true;
    setWasCancelled(true);
    sendMutation.reset();
    // Refetch to pick up whatever the server has persisted so far
    utils.chat.getTask.invalidate();
    utils.chat.getTasks.invalidate();
  }, [sendMutation, utils]);

  return {
    sendMessage,
    cancelSend,
    wasCancelled,
    isLoading: sendMutation.isPending,
    isError: sendMutation.isError,
    error: sendMutation.error,
  };
}
