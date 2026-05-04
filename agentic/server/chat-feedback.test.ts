import { describe, expect, it } from "vitest";

import { buildChatFeedbackPayload } from "../client/src/components/chat-ui/task-messages/chat-feedback";
import type { TaskMessage } from "../client/src/components/chat-ui/types";

function makeUserMessage(content: string): TaskMessage {
  return {
    id: "user-1",
    task_id: "task-1",
    content: {
      type: "text",
      author: "user",
      format: "plain",
      content,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    streaming_status: "DONE",
  };
}

function makeAgentMessage(opts?: {
  content?: string;
  citations?: NonNullable<TaskMessage["attributes"]>["citations"];
  confidence?: number;
}): TaskMessage {
  return {
    id: "agent-1",
    task_id: "task-1",
    content: {
      type: "text",
      author: "agent",
      format: "markdown",
      content: opts?.content ?? "Grounded answer",
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    streaming_status: "DONE",
    attributes: {
      confidence: opts?.confidence ?? 0.82,
      citations: opts?.citations,
    },
  };
}

describe("buildChatFeedbackPayload", () => {
  it("uses citation document ids and stable synthetic chunk ids", () => {
    const payload = buildChatFeedbackPayload({
      signal: "down",
      userMessage: makeUserMessage("What does the policy say?"),
      agentMessage: makeAgentMessage({
        citations: [
          {
            document_id: "doc-1",
            title: "Policy",
          },
          {
            documentId: "doc-2",
            chunk_id: "chunk-2",
            title: "FAQ",
          },
        ],
      }),
    });

    expect(payload).toEqual({
      signal: "down",
      query: "What does the policy say?",
      answer: "Grounded answer",
      chunkIds: ["chat-feedback:agent-1:chunk:1", "chunk-2"],
      documentIds: ["doc-1", "doc-2"],
      confidence: 0.82,
      evalScore: 0,
    });
  });

  it("falls back to a response-level synthetic chunk when no citations exist", () => {
    const payload = buildChatFeedbackPayload({
      signal: "up",
      userMessage: makeUserMessage("Summarize this"),
      agentMessage: makeAgentMessage({ citations: [] }),
    });

    expect(payload?.chunkIds).toEqual(["chat-feedback:agent-1:response"]);
    expect(payload?.documentIds).toEqual([]);
  });
});
