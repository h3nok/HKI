/**
 * GlobalLoadingScreen — Thin wrapper around BrandLoader (fullscreen variant).
 * Provides an optional rotating message bar based on the current context.
 * The `context` prop is strictly typed and defaults to "default" so
 * external callers cannot inject arbitrary strings.  Messages are chosen
 * from internal arrays only (no user input) which hardens against XSS.
 *
 * Use `context="knowledge"` to show Knowledge‑Platform‑specific hints.
 * Most callers can continue to import BrandLoader directly unless they
 * want the message rotation behavior.
 */

import { useState, useEffect } from "react";
import { BrandLoader } from "./brand-loader";

const KNOWLEDGE_MESSAGES = [
  "Loading Knowledge Platform…",
  "Initializing Document Pipeline…",
  "Connecting to Vector Store…",
  "Preparing Retrieval Engine…",
  "Syncing Knowledge Graph…",
];

interface GlobalLoadingScreenProps {
  /** Optional context hint — use "knowledge" for KB-specific messages */
  context?: "default" | "knowledge";
}

export function GlobalLoadingScreen({
  context = "default",
}: GlobalLoadingScreenProps = {}) {
  // choose messages based on context; keep a safe whitelist
  const messages = context === "knowledge" ? KNOWLEDGE_MESSAGES : ["Loading…"];

  // rotate through messages every few seconds to reassure user the app is still working
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (messages.length <= 1) return;
    const tid = setInterval(() => {
      setIdx(i => (i + 1) % messages.length);
    }, 3000);
    return () => clearInterval(tid);
  }, [messages]);

  // protect against strange context values by falling back to default array
  const message = messages[idx] ?? messages[0];

  return (
    <BrandLoader
      variant="fullscreen"
      // we forward message via aria or slot if BrandLoader supports it
      message={message}
      aria-label={message}
    />
  );
}
