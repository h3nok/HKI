import { memo } from "react";
import { cva } from "class-variance-authority";
import { MarkdownResponse } from "../ui/markdown-response";
import { cn } from "@hki/ui";
import { FONT_FAMILY } from "@/design-system/tokens";
import type { Evidence } from "../ui/evidence-chip";
import type { TextContent } from "../types";
import { useTypewriter } from "../hooks/use-typewriter";

const RESPONSE_FONT =
  '"Plus Jakarta Sans", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif';

const variants = cva(
  "min-w-0 text-[14.5px] leading-[1.72] tracking-normal sm:text-[15px]",
  {
    variants: {
      author: {
        user: "max-w-[58ch] font-medium text-inherit",
        agent: "max-w-[68ch] font-normal text-foreground",
      },
    },
  }
);

type TaskMessageTextContentProps = {
  content: TextContent;
  isStreaming?: boolean;
  animate?: boolean;
  /** Evidence for inline [N] citation rendering */
  evidence?: Evidence[];
  canViewLibrary?: boolean;
  libraryScopeId?: string | null;
};

function TaskMessageTextContentImpl({
  content,
  isStreaming,
  animate = false,
  evidence,
  canViewLibrary,
  libraryScopeId,
}: TaskMessageTextContentProps) {
  const { displayedText, isTyping } = useTypewriter(
    content.content,
    10,
    animate && content.author === "agent"
  );

  const textToShow =
    animate && content.author === "agent" ? displayedText : content.content;
  const showCursor = isStreaming || (animate && isTyping);

  return (
    <div
      className={cn(variants({ author: content.author }))}
      style={{
        fontFamily:
          content.author === "agent" ? RESPONSE_FONT : FONT_FAMILY.sans,
        fontKerning: "normal",
        overflowWrap: "anywhere",
      }}
    >
      {content.author === "user" ? (
        <span className="agentic-user-message-text whitespace-pre-wrap wrap-break-word leading-[1.62] text-inherit">
          {content.content}
        </span>
      ) : (
        <div className="relative">
          <MarkdownResponse
            evidence={evidence}
            canViewLibrary={canViewLibrary}
            libraryScopeId={libraryScopeId}
          >
            {textToShow}
          </MarkdownResponse>
          {showCursor && (
            <span
              className="inline-block w-1.5 h-4 ml-1 align-middle animate-pulse rounded-sm"
              style={{ background: "var(--primary)" }}
            />
          )}
        </div>
      )}
    </div>
  );
}

export const TaskMessageTextContent = memo(TaskMessageTextContentImpl);
