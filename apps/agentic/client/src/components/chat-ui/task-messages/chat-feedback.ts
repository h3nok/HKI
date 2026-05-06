import type { TaskMessage } from "../types";

export type ChatFeedbackSignal = "up" | "down";

export type ChatFeedbackPayload = {
  signal: ChatFeedbackSignal;
  query: string;
  answer: string;
  chunkIds: string[];
  documentIds: string[];
  confidence: number;
  evalScore: number;
};

function readTextContent(message: TaskMessage): string {
  return message.content.type === "text" ? message.content.content.trim() : "";
}

function normalizeId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function buildChatFeedbackPayload(options: {
  userMessage: TaskMessage;
  agentMessage: TaskMessage;
  signal: ChatFeedbackSignal;
}): ChatFeedbackPayload | null {
  const query = readTextContent(options.userMessage);
  const answer = readTextContent(options.agentMessage);

  if (!query || !answer) {
    return null;
  }

  const citations = Array.isArray(options.agentMessage.attributes?.citations)
    ? options.agentMessage.attributes?.citations
    : [];

  const chunkIds =
    citations.length > 0
      ? citations.map((citation, index) => {
          const chunkId =
            normalizeId(citation.chunk_id) ||
            normalizeId(citation.chunkId) ||
            normalizeId(citation.id);
          return (
            chunkId ||
            `chat-feedback:${options.agentMessage.id}:chunk:${index + 1}`
          );
        })
      : [`chat-feedback:${options.agentMessage.id}:response`];

  const documentIds = citations
    .map(
      citation =>
        normalizeId(citation.document_id) || normalizeId(citation.documentId)
    )
    .filter(Boolean);

  return {
    signal: options.signal,
    query,
    answer,
    chunkIds,
    documentIds,
    confidence:
      typeof options.agentMessage.attributes?.confidence === "number"
        ? options.agentMessage.attributes.confidence
        : 0,
    evalScore: 0,
  };
}
