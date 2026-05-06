import { describe, expect, it } from "vitest";

import { extractEvidenceFromMessage } from "../client/src/components/chat-ui/task-messages/citation-adapter";
import type { TaskMessage } from "../client/src/components/chat-ui/types";

function makeAgentMessage(
  citations: NonNullable<TaskMessage["attributes"]>["citations"]
): TaskMessage {
  return {
    id: "assistant-1",
    task_id: "task-1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    streaming_status: "DONE",
    content: {
      type: "text",
      author: "agent",
      format: "markdown",
      content: "Grounded answer",
    },
    attributes: {
      citations,
    },
  };
}

describe("chat citation adapter", () => {
  it("maps orchestrator preview and highlight fields into visible evidence snippets", () => {
    const [evidence] = extractEvidenceFromMessage(
      makeAgentMessage([
        {
          document_id: "doc-123",
          chunk_id: "chunk-9",
          document_title: "execution-plan.md",
          source_url: "https://example.test/execution-plan",
          preview: "Preview text from the retrieved chunk.",
          highlight: "Highlighted supporting sentence.",
          score: 0.97,
          page_or_section: "Section 4",
        },
      ])
    );

    expect(evidence.title).toBe("execution-plan.md");
    expect(evidence.snippet).toBe("Highlighted supporting sentence.");
    expect(evidence.url).toBe("https://example.test/execution-plan");
    expect(evidence.confidence).toBe(97);
    expect(evidence.metadata?.section).toBe("Section 4");
    expect(evidence.metadata?.documentId).toBe("doc-123");
    expect(evidence.metadata?.chunkId).toBe("chunk-9");
  });

  it("falls back to preview text and stable ids when highlight is absent", () => {
    const [evidence] = extractEvidenceFromMessage(
      makeAgentMessage([
        {
          id: "citation-1",
          title: "Policy Doc",
          preview: "Fallback preview.",
          score: 0.81,
        },
      ])
    );

    expect(evidence.id).toBe("citation-1");
    expect(evidence.snippet).toBe("Fallback preview.");
    expect(evidence.confidence).toBe(81);
  });
});
