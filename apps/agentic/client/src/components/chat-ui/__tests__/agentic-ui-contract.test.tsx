import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("wouter", () => ({
  Link: ({
    to,
    children,
    ...props
  }: {
    to: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => React.createElement("a", { href: to, ...props }, children),
}));

import { AgentPlanCard } from "../ui/agent-plan-card";
import { ArtifactViewer } from "../ui/artifact-viewer";
import { MessageBubble } from "../task-messages/message-bubble";
import { SidebarHeader } from "../task-sidebar/sidebar-header";
import { SuggestionGrid } from "../suggestions/suggestion-grid";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { TaskMessage } from "../types";

function textMessage(author: "user" | "agent"): TaskMessage {
  return {
    id: `${author}-message`,
    task_id: "task-1",
    created_at: "2026-05-08T18:00:00.000Z",
    updated_at: "2026-05-08T18:00:00.000Z",
    streaming_status: "DONE",
    content: {
      type: "text",
      author,
      format: "plain",
      content:
        author === "user"
          ? "Show me the current scope."
          : "The active scope is isolated.",
    },
  };
}

describe("Agentic UI contract", () => {
  it("renders suggestion tiles with the agentic chrome hooks", () => {
    const html = renderToStaticMarkup(
      <SuggestionGrid
        prompts={["Check retrieval quality", "Review scoped tools"]}
        onSelect={vi.fn()}
      />
    );

    expect(html).toContain("agentic-suggestion-tile");
    expect(html).toContain("agentic-suggestion-glyph");
    expect(html).toContain("Check retrieval quality");
    expect(html).toContain("Review scoped tools");
  });

  it("renders agent messages with runtime-frame data hooks", () => {
    const html = renderToStaticMarkup(
      <MessageBubble message={textMessage("agent")} isUser={false}>
        <p>Grounded answer</p>
      </MessageBubble>
    );

    expect(html).toContain('data-author="agent"');
    expect(html).toContain("agentic-message-bubble-agent");
    expect(html).toContain('data-variant="default"');
    expect(html).toContain("Grounded answer");
  });

  it("renders user messages with user-frame data hooks", () => {
    const html = renderToStaticMarkup(
      <MessageBubble message={textMessage("user")} isUser>
        <p>Question</p>
      </MessageBubble>
    );

    expect(html).toContain('data-author="user"');
    expect(html).toContain("agentic-message-bubble-user");
    expect(html).toContain("Question");
  });

  it("renders sidebar header command chrome and stream context", () => {
    const html = renderToStaticMarkup(
      <TooltipProvider>
        <SidebarHeader
          onNewTask={vi.fn()}
          onNewProject={vi.fn()}
          onOpenSearch={vi.fn()}
          activeStreamName="Pharmacy"
          activeStreamIcon="pharmacy"
        />
      </TooltipProvider>
    );

    expect(html).toContain("agentic-sidebar-header");
    expect(html).toContain("agentic-sidebar-brand-signal");
    expect(html).toContain("agentic-sidebar-primary-action");
    expect(html).toContain("Pharmacy");
  });

  it("renders plan cards with explicit execution and risk state", () => {
    const html = renderToStaticMarkup(
      <AgentPlanCard
        steps={[
          {
            id: "inspect",
            toolName: "inspect_repo",
            description: "Read scoped frontend files",
            expectedImpact: "No writes outside the agentic UI surface.",
            risk: "medium",
          },
        ]}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onEdit={vi.fn()}
      />
    );

    expect(html).toContain('role="group"');
    expect(html).toContain('data-highest-risk="medium"');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('data-risk="medium"');
    expect(html).toContain('aria-label="Approve and run plan"');
  });

  it("renders artifact viewers with accessible action state", () => {
    const html = renderToStaticMarkup(
      <ArtifactViewer
        artifact={{
          id: "artifact-1",
          name: "summary.ts",
          type: "code",
          language: "ts",
          content: "export const status = 'ready';",
          size: 30,
        }}
      />
    );

    expect(html).toContain("agentic-artifact-viewer");
    expect(html).toContain('data-artifact-type="code"');
    expect(html).toContain('aria-label="Artifact summary.ts"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("export const status");
  });
});
