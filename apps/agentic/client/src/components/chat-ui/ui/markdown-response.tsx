/**
 * MarkdownResponse — Production-grade Markdown renderer
 *
 * Powered by react-markdown + remark-gfm for full GFM support:
 *   • Fenced code blocks with syntax highlighting (react-syntax-highlighter)
 *   • Copy-to-clipboard button on every code block
 *   • Tables, task lists, strikethrough, autolinks
 *   • Blockquotes, nested lists, horizontal rules
 *   • Links open in new tab with rel="noopener"
 *   • Theme-aware via CSS variables
 */

import {
  useState,
  useCallback,
  memo,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Check, Copy, ExternalLink } from "lucide-react";
import { cn } from "@hki/ui";
import { FONT_FAMILY } from "@/design-system/tokens";
import type { Evidence } from "../ui/evidence-chip";
import { EvidenceChip } from "../ui/evidence-chip";

// ── Types ────────────────────────────────────────────────────────────────

type MarkdownResponseProps = {
  children: string;
  className?: string;
  /** When provided, [N] markers in text are rendered as interactive citation chips. */
  evidence?: Evidence[];
  canViewLibrary?: boolean;
  libraryScopeId?: string | null;
};

const PROSE_BODY_STYLE = {
  color: "var(--foreground)",
  fontFamily: FONT_FAMILY.body,
  fontKerning: "normal" as const,
  letterSpacing: "0",
  lineHeight: 1.72,
  fontWeight: 400,
  overflowWrap: "anywhere" as const,
};

const PROSE_HEADING_STYLE = {
  fontFamily: FONT_FAMILY.display,
  letterSpacing: "-0.02em",
};

// ── Code Block with Copy Button ──────────────────────────────────────────

function CodeBlock({
  language,
  children,
}: {
  language: string | null;
  children: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard not available */
    }
  }, [children]);

  return (
    <div className="group relative my-3 overflow-hidden rounded-xl border border-border/45 bg-card/70">
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-3 py-1.5"
        style={{
          background: "color-mix(in srgb, var(--muted) 76%, transparent)",
        }}
      >
        <span
          className="select-none font-mono text-[11px] uppercase tracking-[0.18em]"
          style={{ color: "var(--muted-foreground)", opacity: 0.7 }}
        >
          {language || "code"}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-all duration-150 hover:bg-primary/10"
          style={{
            color: copied ? "var(--primary)" : "var(--muted-foreground)",
          }}
          aria-label={copied ? "Copied!" : "Copy code"}
        >
          {copied ? (
            <Check className="w-3 h-3" />
          ) : (
            <Copy className="w-3 h-3" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {/* Syntax-highlighted code */}
      <SyntaxHighlighter
        language={language || "text"}
        style={oneDark}
        customStyle={{
          margin: 0,
          borderRadius: 0,
          fontSize: 12.5,
          lineHeight: 1.62,
          padding: "12px 14px",
        }}
        wrapLongLines
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
}

// ── Inline Code ──────────────────────────────────────────────────────────

function InlineCode({ children, ...props }: ComponentPropsWithoutRef<"code">) {
  return (
    <code
      className="rounded px-1.5 py-0.5 font-mono text-[0.92em]"
      style={{
        background: "color-mix(in srgb, var(--muted) 60%, transparent)",
        color: "var(--primary)",
      }}
      {...props}
    >
      {children}
    </code>
  );
}

// ── Markdown Component Overrides ─────────────────────────────────────────

const components: React.ComponentPropsWithoutRef<
  typeof ReactMarkdown
>["components"] = {
  // react-markdown v10: `pre` wraps fenced code blocks, `code` is used for both.
  // We override `pre` to render CodeBlock, and `code` for inline only.
  pre({ children, ...props }: any) {
    // react-markdown renders <pre><code className="language-X">…</code></pre>
    // Extract language + text from the nested <code> element.
    const codeChild = Array.isArray(children) ? children[0] : children;
    if (codeChild?.type === "code" || codeChild?.props?.className) {
      const className = codeChild.props?.className || "";
      const match = /language-(\w+)/.exec(className);
      const codeString = String(codeChild.props?.children ?? "").replace(
        /\n$/,
        ""
      );
      return <CodeBlock language={match?.[1] || null}>{codeString}</CodeBlock>;
    }
    // Fallback: plain <pre> without recognized <code> child
    const text = String(codeChild?.props?.children ?? children ?? "").replace(
      /\n$/,
      ""
    );
    return <CodeBlock language={null}>{text}</CodeBlock>;
  },
  code({ className, children, ...props }: any) {
    // After the `pre` override above, any remaining `code` is inline.
    return <InlineCode {...props}>{children}</InlineCode>;
  },

  // Links: external icon + new tab
  a({ href, children, ...props }: any) {
    const isExternal = href?.startsWith("http");
    return (
      <a
        href={href}
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noopener noreferrer" : undefined}
        className="text-primary hover:text-primary/80 underline underline-offset-2 decoration-primary/30 hover:decoration-primary/60 transition-colors inline-flex items-center gap-0.5"
        {...props}
      >
        {children}
        {isExternal && (
          <ExternalLink className="w-3 h-3 inline-block shrink-0" />
        )}
      </a>
    );
  },

  // Blockquotes
  blockquote({ children, ...props }: any) {
    return (
      <blockquote
        className="my-3 rounded-r-xl py-2 pl-4 pr-4"
        style={{
          borderLeft:
            "3px solid color-mix(in srgb, var(--primary) 60%, var(--border))",
          color: "var(--foreground)",
          background: "color-mix(in srgb, var(--primary) 4%, var(--card))",
          fontStyle: "normal",
          opacity: 0.92,
        }}
        {...props}
      >
        {children}
      </blockquote>
    );
  },

  // Tables
  table({ children, ...props }: any) {
    return (
      <div className="my-3 overflow-x-auto rounded-xl border border-border/55 bg-card/50">
        <table
          className="min-w-full text-[13px] leading-relaxed sm:text-[14px]"
          {...props}
        >
          {children}
        </table>
      </div>
    );
  },
  thead({ children, ...props }: any) {
    return (
      <thead
        style={{
          background: "color-mix(in srgb, var(--muted) 50%, transparent)",
        }}
        {...props}
      >
        {children}
      </thead>
    );
  },
  th({ children, ...props }: any) {
    return (
      <th
        className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[0.12em] sm:text-[12px]"
        style={{
          color: "var(--muted-foreground)",
          borderBottom: "1px solid var(--border)",
        }}
        {...props}
      >
        {children}
      </th>
    );
  },
  td({ children, ...props }: any) {
    return (
      <td
        className="px-3 py-2"
        style={{
          borderBottom:
            "1px solid color-mix(in srgb, var(--border) 40%, transparent)",
        }}
        {...props}
      >
        {children}
      </td>
    );
  },

  // Inline formatting
  strong({ children, ...props }: any) {
    return (
      <strong
        className="font-bold"
        style={{ color: "var(--foreground)" }}
        {...props}
      >
        {children}
      </strong>
    );
  },
  em({ children, ...props }: any) {
    return (
      <em
        className="italic"
        style={{ color: "var(--muted-foreground)" }}
        {...props}
      >
        {children}
      </em>
    );
  },
  del({ children, ...props }: any) {
    return (
      <del className="line-through opacity-60" {...props}>
        {children}
      </del>
    );
  },

  // Headings
  h1({ children, ...props }: any) {
    return (
      <h1
        className="mb-2 mt-5 text-[1.15rem] font-extrabold leading-tight text-foreground"
        style={PROSE_HEADING_STYLE}
        {...props}
      >
        {children}
      </h1>
    );
  },
  h2({ children, ...props }: any) {
    return (
      <h2
        className="mb-1.5 mt-4 pl-3 text-[0.98rem] font-bold leading-snug text-foreground"
        style={{
          ...PROSE_HEADING_STYLE,
          borderLeft: "2.5px solid var(--primary)",
        }}
        {...props}
      >
        {children}
      </h2>
    );
  },
  h3({ children, ...props }: any) {
    return (
      <h3
        className="mb-1 mt-3.5 text-[0.93rem] font-semibold leading-snug text-foreground/92"
        style={PROSE_HEADING_STYLE}
        {...props}
      >
        {children}
      </h3>
    );
  },
  h4({ children, ...props }: any) {
    return (
      <h4
        className="mb-1 mt-3 text-[0.88rem] font-semibold leading-snug text-foreground/82"
        style={PROSE_HEADING_STYLE}
        {...props}
      >
        {children}
      </h4>
    );
  },

  // Lists
  ul({ children, ...props }: any) {
    return (
      <ul
        className="my-2.5 list-disc space-y-1.5 pl-5 marker:text-primary/50"
        {...props}
      >
        {children}
      </ul>
    );
  },
  ol({ children, ...props }: any) {
    return (
      <ol
        className="my-2.5 list-decimal space-y-1.5 pl-5 marker:text-primary/50 marker:font-semibold"
        {...props}
      >
        {children}
      </ol>
    );
  },
  li({ children, ...props }: any) {
    return (
      <li className="pl-1 leading-[1.62] [&>p]:my-0.5" {...props}>
        {children}
      </li>
    );
  },

  // Paragraphs
  p({ children, ...props }: any) {
    return (
      <p className="my-2 leading-[1.68] text-foreground/93" {...props}>
        {children}
      </p>
    );
  },

  // Horizontal rule
  hr({ ...props }: any) {
    return (
      <hr
        className="my-2.5 border-none h-px"
        style={{ background: "var(--border)" }}
        {...props}
      />
    );
  },

  // Task list items (GFM)
  input({ checked, ...props }: any) {
    return (
      <input
        type="checkbox"
        checked={checked}
        readOnly
        className="mr-2 rounded accent-primary"
        style={{ verticalAlign: "middle" }}
        {...props}
      />
    );
  },
};

// ── Inline Citation Markers ───────────────────────────────────────────────

/** Regex for [N] citation markers — matches [1], [2], [1][2], etc. */
const CITATION_RE = /\[(\d+)\]/g;

/**
 * Walk ReactNode children and replace [N] text with EvidenceChip components.
 * Non-text children (elements) are passed through untouched.
 */
function injectCitationChips(
  children: ReactNode,
  evidence: Evidence[],
  canViewLibrary: boolean,
  libraryScopeId: string | null | undefined
): ReactNode {
  if (!children) return children;

  const processChild = (child: ReactNode, key: number): ReactNode => {
    if (typeof child !== "string") return child;

    const parts: ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    const re = new RegExp(CITATION_RE.source, "g");

    while ((match = re.exec(child)) !== null) {
      const idx = parseInt(match[1], 10);
      const ev = evidence[idx - 1]; // 1-indexed → 0-indexed
      if (!ev) continue;

      // Push text before the match
      if (match.index > lastIndex) {
        parts.push(child.slice(lastIndex, match.index));
      }
      parts.push(
        <EvidenceChip
          key={`cite-${key}-${match.index}`}
          evidence={ev}
          index={idx}
          canViewLibrary={canViewLibrary}
          libraryScopeId={libraryScopeId}
        />
      );
      lastIndex = re.lastIndex;
    }

    // No matches — return the original string
    if (parts.length === 0) return child;

    // Push trailing text
    if (lastIndex < child.length) {
      parts.push(child.slice(lastIndex));
    }
    return <>{parts}</>;
  };

  if (Array.isArray(children)) {
    return children.map((child, i) => processChild(child, i));
  }
  return processChild(children, 0);
}

/** Count how many unique [N] markers appear in the full text. */
export function countInlineCitations(text: string): number {
  const seen = new Set<number>();
  let m: RegExpExecArray | null;
  const re = new RegExp(CITATION_RE.source, "g");
  while ((m = re.exec(text)) !== null) {
    seen.add(parseInt(m[1], 10));
  }
  return seen.size;
}

// ── Main Component ───────────────────────────────────────────────────────

function MarkdownResponseImpl({
  children,
  className,
  evidence,
  canViewLibrary = false,
  libraryScopeId,
}: MarkdownResponseProps) {
  const hasEvidence = evidence && evidence.length > 0;

  // Build components with citation injection when evidence is available
  const effectiveComponents = hasEvidence
    ? {
        ...components,
        p({ children: pChildren, ...props }: any) {
          return (
            <p className="my-2 leading-[1.68] text-foreground/93" {...props}>
              {injectCitationChips(
                pChildren,
                evidence,
                canViewLibrary,
                libraryScopeId
              )}
            </p>
          );
        },
        li({ children: liChildren, ...props }: any) {
          return (
            <li className="pl-1 leading-[1.62] [&>p]:my-0.5" {...props}>
              {injectCitationChips(
                liChildren,
                evidence,
                canViewLibrary,
                libraryScopeId
              )}
            </li>
          );
        },
      }
    : components;

  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none antialiased",
        "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      )}
      style={PROSE_BODY_STYLE}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={effectiveComponents}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

export const MarkdownResponse = memo(MarkdownResponseImpl);
