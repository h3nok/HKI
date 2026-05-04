"use client";

import { useState, type ReactNode } from "react";
import {
  User,
  Bot,
  Copy,
  Check,
  RefreshCw,
  Edit2,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { cn } from "@hki/ui";
import type { ChatMessage } from "../types";

export type FeedbackType = "positive" | "negative";

export interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean | undefined;
  streamingContent?: string | undefined;
  className?: string | undefined;
  /** Custom avatar component */
  avatar?: ReactNode | undefined;
  /** Custom content renderer */
  renderContent?: ((message: ChatMessage) => ReactNode) | undefined;
  /** Show message actions (copy, regenerate, edit, feedback) */
  showActions?: boolean | undefined;
  /** Confidence score (0-1) for assistant messages */
  confidence?: number | undefined;
  /** Called when user provides feedback */
  onFeedback?: ((messageId: string, type: FeedbackType) => void) | undefined;
  /** Called when user wants to regenerate response */
  onRegenerate?: ((messageId: string) => void) | undefined;
  /** Called when user wants to edit their message */
  onEdit?: ((messageId: string) => void) | undefined;
}

export function MessageBubble({
  message,
  isStreaming = false,
  streamingContent,
  className,
  avatar,
  renderContent,
  showActions = true,
  onFeedback,
  onRegenerate,
  onEdit,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackType | null>(null);

  const isUser = message.role === "user";
  const content =
    isStreaming && streamingContent
      ? streamingContent
      : getMessageContent(message);

  const handleCopy = async () => {
    const textContent =
      typeof content === "string" ? content : JSON.stringify(content);
    await navigator.clipboard.writeText(textContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFeedback = (type: FeedbackType) => {
    setFeedback(type);
    onFeedback?.(message.id, type);
  };

  return (
    <div
      className={cn(
        "group flex gap-3",
        isUser ? "flex-row-reverse" : "flex-row",
        className,
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary" : "bg-primary/10",
        )}
      >
        {avatar ||
          (isUser ? (
            <User className="h-4 w-4 text-primary-foreground" />
          ) : (
            <Bot className="h-4 w-4 text-primary" />
          ))}
      </div>

      {/* Content */}
      <div
        className={cn(
          "flex max-w-[80%] flex-col gap-1",
          isUser ? "items-end" : "items-start",
        )}
      >
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground",
          )}
        >
          {renderContent ? (
            renderContent(message)
          ) : (
            <div className="text-sm leading-relaxed whitespace-pre-wrap">
              {content}
              {isStreaming && (
                <span className="inline-block w-0.5 h-4 bg-current animate-pulse ml-0.5" />
              )}
            </div>
          )}
        </div>

        {/* Timestamp */}
        <div className="flex items-center gap-2 px-1">
          <span className="text-xs text-muted-foreground">
            {formatTime(message.timestamp)}
          </span>
        </div>

        {/* Actions */}
        {showActions && !isStreaming && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity px-1">
            <button
              onClick={handleCopy}
              className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>

            {!isUser && onRegenerate && (
              <button
                onClick={() => onRegenerate(message.id)}
                className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Regenerate</span>
              </button>
            )}

            {isUser && onEdit && (
              <button
                onClick={() => onEdit(message.id)}
                className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <Edit2 className="h-3.5 w-3.5" />
                <span>Edit</span>
              </button>
            )}

            {!isUser && onFeedback && (
              <div className="ml-2 flex items-center gap-1 border-l border-border pl-2">
                <button
                  onClick={() => handleFeedback("positive")}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                    feedback === "positive"
                      ? "bg-green-100 text-green-700"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleFeedback("negative")}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                    feedback === "negative"
                      ? "bg-red-100 text-red-700"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function getMessageContent(message: ChatMessage): string {
  switch (message.type) {
    case "text":
      return message.content;
    case "reasoning":
      return message.content;
    case "data":
      return JSON.stringify(message.content, null, 2);
    case "tool_request":
      return `Calling ${message.toolName}...`;
    case "tool_response":
      return message.error || JSON.stringify(message.output, null, 2);
    case "image":
      return `[Image: ${message.alt || "Image"}]`;
    case "file":
      return `[File: ${message.filename}]`;
    default:
      return "";
  }
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
