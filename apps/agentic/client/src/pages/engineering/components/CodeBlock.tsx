import { useState, useEffect, useCallback, type ReactNode } from "react";
import { getSingletonHighlighter, type BundledLanguage } from "shiki";
import { cn } from "@hki/ui";
import { Check, Copy } from "lucide-react";

// ── Supported languages ───────────────────────────────────────────────────────

const LANGS: BundledLanguage[] = [
  "typescript",
  "javascript",
  "tsx",
  "jsx",
  "python",
  "bash",
  "shell",
  "json",
  "yaml",
  "sql",
  "diff",
  "markdown",
  "html",
  "css",
];

const FALLBACK_LANG: BundledLanguage = "markdown";

const LANG_LABELS: Record<string, string> = {
  typescript: "TypeScript",
  javascript: "JavaScript",
  tsx: "TSX",
  jsx: "JSX",
  python: "Python",
  bash: "Bash",
  shell: "Shell",
  json: "JSON",
  yaml: "YAML",
  sql: "SQL",
  diff: "Diff",
  markdown: "Markdown",
  html: "HTML",
  css: "CSS",
};

// ── Singleton highlighter ─────────────────────────────────────────────────────

type Hl = Awaited<ReturnType<typeof getSingletonHighlighter>>;
let _promise: Promise<Hl> | null = null;

function getHighlighter(): Promise<Hl> {
  if (!_promise) {
    _promise = getSingletonHighlighter({
      themes: ["github-light", "github-dark-dimmed"],
      langs: LANGS,
    });
  }
  return _promise;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeLang(raw: string | undefined): BundledLanguage {
  if (!raw) return FALLBACK_LANG;
  const lower = raw.toLowerCase().replace(/^language-/, "");
  return (
    LANGS.includes(lower as BundledLanguage) ? lower : FALLBACK_LANG
  ) as BundledLanguage;
}

function highlight(hl: Hl, code: string, lang: BundledLanguage): string {
  try {
    return hl.codeToHtml(code, {
      lang,
      themes: { light: "github-light", dark: "github-dark-dimmed" },
      defaultColor: false,
    });
  } catch {
    return hl.codeToHtml(code, {
      lang: FALLBACK_LANG,
      themes: { light: "github-light", dark: "github-dark-dimmed" },
      defaultColor: false,
    });
  }
}

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({ getText }: { getText: () => string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const text = getText();
    if (!text) return;
    void navigator.clipboard?.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }, [getText]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "Copied" : "Copy code"}
      className={cn(
        "absolute right-2.5 top-2.5 z-10 inline-flex h-7 w-7 items-center justify-center rounded-md border transition-all duration-150",
        "border-white/12 bg-white/8 text-white/50",
        "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
        "hover:border-white/20 hover:bg-white/15 hover:text-white/80"
      )}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

// ── CodeBlock ─────────────────────────────────────────────────────────────────

export interface CodeBlockProps {
  code: string;
  lang?: string;
  filename?: string;
  className?: string;
}

export function CodeBlock({ code, lang, filename, className }: CodeBlockProps) {
  const [html, setHtml] = useState<string>("");
  const normalizedLang = normalizeLang(lang);
  const requestedLang = lang?.toLowerCase().replace(/^language-/, "");
  const label =
    filename ??
    (requestedLang && LANGS.includes(requestedLang as BundledLanguage)
      ? LANG_LABELS[normalizedLang]
      : "Text");

  useEffect(() => {
    let cancelled = false;
    void getHighlighter().then(hl => {
      if (cancelled) return;
      const result = highlight(hl, code, normalizedLang);
      if (!cancelled) setHtml(result);
    });
    return () => {
      cancelled = true;
    };
  }, [code, normalizedLang]);

  return (
    <div
      className={cn(
        "group hki-code-block relative my-8 overflow-hidden rounded-lg",
        "border border-zinc-800 bg-[#24292e] dark:bg-[#22272e]",
        "shadow-[0_4px_24px_rgba(0,0,0,0.18)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.35)]",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/8 px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-white/12" />
          <span className="h-3 w-3 rounded-full bg-white/12" />
          <span className="h-3 w-3 rounded-full bg-white/12" />
        </div>
        <span className="flex-1 text-center font-mono text-[11px] font-medium tracking-[0.1em] text-white/35">
          {label}
        </span>
      </div>

      {/* Code area */}
      <div className="relative">
        <CopyButton getText={() => code} />
        {html ? (
          <div
            className="hki-code-block overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <pre className="overflow-x-auto p-5 pr-12 font-mono text-[13px] leading-[1.65] text-white/70">
            <code>{code}</code>
          </pre>
        )}
      </div>
    </div>
  );
}

// ── Extract code from react-markdown pre children ─────────────────────────────

export function extractCodeProps(children: ReactNode): {
  code: string;
  lang: string | undefined;
} | null {
  if (!children) return null;
  const arr = Array.isArray(children) ? children : [children];
  for (const child of arr) {
    if (
      child &&
      typeof child === "object" &&
      "type" in child &&
      child.type === "code"
    ) {
      const el = child as {
        type: "code";
        props: { className?: string; children?: ReactNode };
      };
      const lang = el.props.className?.replace("language-", "");
      const code = String(el.props.children ?? "").trimEnd();
      return { code, lang };
    }
  }
  return null;
}
