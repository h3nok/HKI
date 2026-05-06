/**
 * Agentic Chat Page
 *
 * Main entry point for the Agentic platform chat interface.
 * Uses the premium ChatUIRoot component with full token system integration.
 */

import { ChatUIRoot } from "@/components/chat-ui";
import { BrandLoader } from "@/components/ui/brand-loader";
import { trpc } from "@/lib/trpc";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function AgenticChat() {
  const { data: user, isLoading } = trpc.auth.me.useQuery();
  usePageMeta("Chat — Hermetic", "/favicon.svg");

  if (isLoading) {
    return <BrandLoader variant="fullscreen" message="Loading…" />;
  }

  if (!user) {
    return (
      <div
        className="flex h-screen items-center justify-center bg-background text-foreground"
        role="region"
        aria-label="Authentication required"
      >
        <div className="text-center max-w-sm px-6">
          <div
            className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary flex items-center justify-center"
            aria-hidden
          >
            <svg
              className="w-8 h-8 text-primary-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">
            Authentication required
          </h2>
          <p className="text-muted-foreground text-sm">
            Please sign in to access the Agentic platform.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-screen w-screen overflow-hidden"
      role="region"
      aria-label="Agentic platform"
    >
      <ChatUIRoot userId={user.id} />
    </div>
  );
}
