import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  BookOpen,
  ArrowLeft,
  ExternalLink,
  Sun,
  Moon,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Lock,
  Zap,
  ListFilter,
  HeartPulse,
  Loader2,
  Search,
  Sparkles,
  GitCompare,
  BarChart3,
  MessageSquareWarning,
  Activity,
  Shield,
  Database,
  ChevronsDownUp,
  ChevronsUpDown,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@hki/ui";
import { useSearch } from "wouter";
import {
  buildKnowledgeWorkspaceHref,
  extractWorkspaceScopeFromSearch,
} from "@/_core/workspace-navigation";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { FONT_FAMILY } from "@hki/ui";

// ── Types ───────────────────────────────────────────────────────────────────

interface Endpoint {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  tag: string;
  summary: string;
  description: string;
  parameters?: readonly any[];
  requestBody?: any;
  operationId?: string;
  responses: Record<string, any>;
  security?: readonly any[];
}

type ServiceKey = "pipeline" | "vectorStore";
type ServiceStatus = "checking" | "online" | "offline";

// ── Parse spec into structured endpoints ────────────────────────────────────

function parseEndpoints(
  spec: Record<string, any> | null | undefined
): Endpoint[] {
  if (!spec?.paths) return [];
  const endpoints: Endpoint[] = [];
  for (const [path, methods] of Object.entries(
    spec.paths as Record<string, any>
  )) {
    for (const [method, op] of Object.entries(methods as Record<string, any>)) {
      if (["get", "post", "put", "delete", "patch"].includes(method)) {
        endpoints.push({
          method: method.toUpperCase() as Endpoint["method"],
          path,
          tag: op.tags?.[0] ?? "default",
          summary: op.summary ?? "",
          description: op.description ?? "",
          parameters: op.parameters,
          requestBody: op.requestBody,
          operationId: op.operationId,
          responses: op.responses ?? {},
          security: op.security,
        });
      }
    }
  }
  return endpoints;
}

// ── Tag metadata ────────────────────────────────────────────────────────────

interface TagMeta {
  icon: LucideIcon;
  label: string;
  description: string;
  category: string;
}

const TAG_META: Record<string, TagMeta> = {
  // Content Pipeline
  ingestion: {
    icon: Zap,
    label: "Ingestion",
    description:
      "Submit text, URLs, or files for processing through the knowledge pipeline.",
    category: "Content Pipeline",
  },
  jobs: {
    icon: ListFilter,
    label: "Jobs",
    description: "Monitor and manage ingestion jobs.",
    category: "Content Pipeline",
  },
  quality: {
    icon: Shield,
    label: "Quality Gates",
    description:
      "Run quality scoring, readability analysis, and PII scanning on content.",
    category: "Content Pipeline",
  },
  versioning: {
    icon: GitCompare,
    label: "Versioning",
    description: "Track document revisions and compute line-by-line diffs.",
    category: "Content Pipeline",
  },
  // Intelligence
  generation: {
    icon: Sparkles,
    label: "Generation",
    description:
      "Generate grounded answers from retrieved chunks using Gemini.",
    category: "Intelligence",
  },
  evaluation: {
    icon: BarChart3,
    label: "Evaluation",
    description: "RAGAS-style evaluation of RAG response quality.",
    category: "Intelligence",
  },
  feedback: {
    icon: MessageSquareWarning,
    label: "Feedback",
    description: "Record chunk-level feedback and retrieve flagged content.",
    category: "Intelligence",
  },
  observability: {
    icon: Activity,
    label: "Observability",
    description:
      "View operation traces and aggregated latency / token metrics.",
    category: "Intelligence",
  },
  // Infrastructure
  knowledge: {
    icon: Database,
    label: "Knowledge",
    description: "Search, ingest, and manage documents in the vector store.",
    category: "Infrastructure",
  },
  search: {
    icon: Search,
    label: "Search",
    description: "Hybrid, vector, and keyword search across indexed content.",
    category: "Infrastructure",
  },
  taxonomy: {
    icon: ListFilter,
    label: "Taxonomy",
    description: "Manage hierarchical tag trees and controlled vocabulary.",
    category: "Infrastructure",
  },
  review: {
    icon: Shield,
    label: "Review",
    description: "Document review workflow — submit, approve, reject.",
    category: "Infrastructure",
  },
  health: {
    icon: HeartPulse,
    label: "Health",
    description: "Service health and readiness probes.",
    category: "Infrastructure",
  },
  default: {
    icon: Zap,
    label: "Other",
    description: "Additional endpoints.",
    category: "Infrastructure",
  },
};

const CATEGORIES = [
  "Content Pipeline",
  "Intelligence",
  "Infrastructure",
] as const;

const METHOD_STYLES: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  GET: {
    bg: "bg-blue-500/10 dark:bg-blue-500/15",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-500/20",
  },
  POST: {
    bg: "bg-primary/10 dark:bg-primary/15",
    text: "text-primary dark:text-primary",
    border: "border-primary/20",
  },
  PUT: {
    bg: "bg-primary/10 dark:bg-primary/15",
    text: "text-primary",
    border: "border-primary/20",
  },
  DELETE: {
    bg: "bg-red-500/10 dark:bg-red-500/15",
    text: "text-red-600 dark:text-red-400",
    border: "border-red-500/20",
  },
  PATCH: {
    bg: "bg-violet-500/10 dark:bg-violet-500/15",
    text: "text-violet-600 dark:text-violet-400",
    border: "border-violet-500/20",
  },
};

const SERVICE_META: Record<
  ServiceKey,
  { label: string; swaggerPath: string; port: number }
> = {
  pipeline: { label: "Pipeline", swaggerPath: "/docs", port: 9508 },
  vectorStore: { label: "Vector Store", swaggerPath: "/docs", port: 9509 },
};

// ── Spec description helpers ────────────────────────────────────────────────

function extractSummary(desc: string | undefined, fallback: string): string {
  if (!desc) return fallback;
  // Grab the first non-heading, non-empty paragraph
  for (const line of desc.split("\n")) {
    const trimmed = line.trim();
    if (
      !trimmed ||
      trimmed.startsWith("#") ||
      trimmed.startsWith("|") ||
      trimmed.startsWith("-")
    )
      continue;
    // Strip inline markdown formatting
    const clean = trimmed.replace(/\*\*/g, "").replace(/`/g, "");
    if (clean.length > 30)
      return clean.length > 200 ? clean.slice(0, 200) + "…" : clean;
  }
  return fallback;
}

function SpecDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!text || text.length < 100) return null;

  return (
    <div className="mt-3">
      <button
        onClick={() => setExpanded(v => !v)}
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary dark:text-primary hover:underline"
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        {expanded ? "Hide" : "Show"} full API description
      </button>
      {expanded && (
        <div className="mt-2 p-4 rounded-xl border border-black/5 dark:border-border/30 bg-card max-w-2xl overflow-x-auto">
          <div className="prose-sm space-y-2">
            {text.split("\n").map((line, i) => {
              const t = line.trim();
              if (!t) return <div key={i} className="h-1" />;
              if (t.startsWith("## "))
                return (
                  <h3
                    key={i}
                    className="text-[13px] font-bold text-foreground mt-3 mb-0.5"
                  >
                    {t.slice(3)}
                  </h3>
                );
              if (t.startsWith("# "))
                return (
                  <h2
                    key={i}
                    className="text-[14px] font-extrabold text-foreground mt-3 mb-0.5"
                  >
                    {t.slice(2)}
                  </h2>
                );
              if (t.startsWith("| ")) {
                // Render table rows
                if (t.replace(/[|\-\s]/g, "") === "") return null; // separator row
                const cells = t
                  .split("|")
                  .filter(Boolean)
                  .map(c => c.trim());
                return (
                  <div
                    key={i}
                    className="flex gap-4 text-[11px] text-foreground dark:text-muted-foreground font-mono"
                  >
                    {cells.map((c, ci) => (
                      <span
                        key={ci}
                        className={cn(
                          "min-w-20",
                          ci === 0 && "font-bold text-foreground"
                        )}
                      >
                        {c.replace(/\*\*/g, "")}
                      </span>
                    ))}
                  </div>
                );
              }
              if (t.startsWith("- "))
                return (
                  <p
                    key={i}
                    className="text-[11px] text-foreground dark:text-muted-foreground pl-3"
                  >
                    <span className="text-primary mr-1">•</span>
                    {t.slice(2).replace(/\*\*/g, "")}
                  </p>
                );
              return (
                <p
                  key={i}
                  className="text-[11px] text-foreground dark:text-muted-foreground leading-relaxed"
                >
                  {t.replace(/\*\*/g, "").replace(/`/g, "")}
                </p>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small components ────────────────────────────────────────────────────────

function MethodBadge({ method }: { method: string }) {
  const s = METHOD_STYLES[method] ?? METHOD_STYLES.GET;
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 text-xs font-extrabold rounded tracking-wider",
        s.bg,
        s.text,
        "border",
        s.border
      )}
    >
      {method}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center justify-center w-6 h-6 rounded text-muted-foreground/50 kb-duotone-text-hover transition-colors"
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

function CodeBlock({ code, title }: { code: string; title?: string }) {
  return (
    <div className="rounded-lg border border-black/5 dark:border-border/30 overflow-hidden">
      {title && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-black/2 dark:bg-card border-b border-black/5 dark:border-border/30">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/50">
            {title}
          </span>
          <CopyButton text={code} />
        </div>
      )}
      <pre
        className="p-4 overflow-x-auto text-[12px] leading-relaxed bg-muted dark:bg-muted text-foreground dark:text-foreground"
        style={{ fontFamily: FONT_FAMILY.mono }}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ── Schema property table ───────────────────────────────────────────────────

function resolveRef(ref: string, spec: Record<string, any>): any {
  const parts = ref.replace("#/", "").split("/");
  let obj: any = spec;
  for (const p of parts) obj = obj?.[p];
  return obj;
}

function SchemaProperties({
  schema,
  spec,
}: {
  schema: any;
  spec: Record<string, any>;
}) {
  const resolved = schema?.$ref ? resolveRef(schema.$ref, spec) : schema;
  if (!resolved?.properties) return null;
  const required = new Set(resolved.required ?? []);

  return (
    <div className="border border-black/5 dark:border-border/30 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-black/3 dark:bg-muted/40">
            <th className="text-left px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-muted-foreground/60">
              Field
            </th>
            <th className="text-left px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-muted-foreground/60">
              Type
            </th>
            <th className="text-left px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-muted-foreground/60">
              Description
            </th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(resolved.properties).map(
            ([name, prop]: [string, any]) => {
              const p = prop?.$ref ? resolveRef(prop.$ref, spec) : prop;
              const type = p?.type ?? (p?.enum ? "enum" : "object");
              return (
                <tr
                  key={name}
                  className="border-t border-black/4 dark:border-border/40"
                >
                  <td
                    className="px-3 py-2 text-[12px] font-medium text-foreground"
                    style={{ fontFamily: FONT_FAMILY.mono }}
                  >
                    {name}
                    {required.has(name) && (
                      <span className="ml-1 text-red-500 dark:text-red-400 text-xs font-bold">
                        *
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className="px-1.5 py-0.5 rounded bg-black/4 dark:bg-muted/70 text-[11px] font-medium text-muted-foreground dark:text-muted-foreground/60"
                      style={{ fontFamily: FONT_FAMILY.mono }}
                    >
                      {type}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-foreground dark:text-muted-foreground text-[12px]">
                    {p?.description ?? ""}
                    {p?.default !== undefined && (
                      <span className="ml-1 text-xs text-muted-foreground/50">
                        (default:{" "}
                        <code className="text-primary dark:text-primary">
                          {JSON.stringify(p.default)}
                        </code>
                        )
                      </span>
                    )}
                  </td>
                </tr>
              );
            }
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Example generation from schema ──────────────────────────────────────────

function generateExample(
  schema: any,
  spec: Record<string, any>,
  depth = 0
): any {
  if (!schema || depth > 4) return null;
  const resolved = schema.$ref ? resolveRef(schema.$ref, spec) : schema;
  if (!resolved) return null;

  if (resolved.example !== undefined) return resolved.example;

  if (resolved.type === "object" || resolved.properties) {
    const obj: Record<string, any> = {};
    for (const [key, prop] of Object.entries(
      resolved.properties ?? ({} as Record<string, any>)
    )) {
      obj[key] = generateExample(prop as any, spec, depth + 1);
    }
    return obj;
  }

  if (resolved.type === "array") {
    const item = generateExample(resolved.items, spec, depth + 1);
    return item != null ? [item] : [];
  }

  if (resolved.enum) return resolved.enum[0];
  if (resolved.default !== undefined) return resolved.default;

  // Sensible placeholders by type + field name hints
  const type = resolved.type ?? "string";
  switch (type) {
    case "string":
      if (resolved.format === "date-time") return "2025-01-15T10:30:00Z";
      if (resolved.format === "uri" || resolved.format === "url")
        return "https://example.com/doc";
      return "string";
    case "integer":
      return 0;
    case "number":
      return 0.0;
    case "boolean":
      return true;
    default:
      return null;
  }
}

function generateResponseExample(
  responses: Record<string, any>,
  spec: Record<string, any>
): any {
  const success = responses["200"] || responses["201"];
  if (!success) return null;
  const explicit = success.content?.["application/json"]?.example;
  if (explicit) return explicit;
  const schema = success.content?.["application/json"]?.schema;
  if (schema) return generateExample(schema, spec);
  return null;
}

function generateCurl(endpoint: Endpoint, example: any): string {
  const base =
    import.meta.env.VITE_KNOWLEDGE_PIPELINE_URL ||
    `${window.location.origin}/api/knowledge`;
  const parts = [`curl -X ${endpoint.method} '${base}${endpoint.path}'`];
  parts.push(`  -H 'Authorization: Bearer <JWT>'`);
  if (endpoint.method !== "GET" && example) {
    parts.push(`  -H 'Content-Type: application/json'`);
    parts.push(`  -d '${JSON.stringify(example)}'`);
  }
  return parts.join(" \\\n");
}

// ── Endpoint card ───────────────────────────────────────────────────────────

function EndpointCard({
  endpoint,
  id,
  open,
  onToggle,
  spec,
}: {
  endpoint: Endpoint;
  id: string;
  open: boolean;
  onToggle: () => void;
  spec: Record<string, any>;
}) {
  const reqSchema = endpoint.requestBody?.content?.["application/json"]?.schema;
  const reqExample =
    endpoint.requestBody?.content?.["application/json"]?.example;
  const successRes = endpoint.responses["200"];
  const resExample = successRes?.content?.["application/json"]?.example;
  const hasAuth = endpoint.security && endpoint.security.length > 0;

  // Auto-generate examples from schema when not explicitly provided
  const effectiveReqExample =
    reqExample ?? (reqSchema ? generateExample(reqSchema, spec) : null);
  const effectiveResExample =
    resExample ?? generateResponseExample(endpoint.responses, spec);
  const curlSnippet = generateCurl(endpoint, effectiveReqExample);

  const [activeExampleTab, setActiveExampleTab] = useState<"example" | "curl">(
    "example"
  );

  return (
    <div
      id={id}
      className={cn(
        "group rounded-xl border bg-card transition-all",
        open
          ? "border-primary/20 dark:border-primary/15 shadow-sm"
          : "border-black/5 dark:border-border/30 kb-duotone-border-hover-soft"
      )}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <MethodBadge method={endpoint.method} />
        <code
          className="text-[13px] font-bold text-foreground"
          style={{ fontFamily: FONT_FAMILY.mono }}
        >
          {endpoint.path}
        </code>
        {hasAuth && <Lock className="w-3 h-3 text-muted-foreground/50" />}
        <span className="ml-auto text-[12px] font-medium text-muted-foreground dark:text-muted-foreground truncate max-w-50">
          {endpoint.summary}
        </span>
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-black/5 dark:border-border/30 pt-4">
          {endpoint.description && (
            <p className="text-[12px] leading-relaxed text-foreground dark:text-muted-foreground whitespace-pre-line max-w-2xl">
              {endpoint.description}
            </p>
          )}

          {endpoint.parameters && endpoint.parameters.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-muted-foreground/60">
                Parameters
              </h4>
              <div className="border border-black/5 dark:border-border/30 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-black/3 dark:bg-muted/40">
                      <th className="text-left px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-muted-foreground/60">
                        Name
                      </th>
                      <th className="text-left px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-muted-foreground/60">
                        In
                      </th>
                      <th className="text-left px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-muted-foreground/60">
                        Type
                      </th>
                      <th className="text-left px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-muted-foreground/60">
                        Description
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {endpoint.parameters.map((p: any) => (
                      <tr
                        key={p.name}
                        className="border-t border-black/4 dark:border-border/40"
                      >
                        <td
                          className="px-3 py-2 text-[12px] font-medium text-foreground"
                          style={{ fontFamily: FONT_FAMILY.mono }}
                        >
                          {p.name}
                          {p.required && (
                            <span className="ml-1 text-red-500 text-xs font-bold">
                              *
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-[11px] font-medium text-muted-foreground dark:text-muted-foreground/60">
                          {p.in}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className="px-1.5 py-0.5 rounded bg-black/4 dark:bg-muted/70 text-[11px] font-medium text-muted-foreground dark:text-muted-foreground/60"
                            style={{ fontFamily: FONT_FAMILY.mono }}
                          >
                            {p.schema?.type ?? "string"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-[12px] text-foreground dark:text-muted-foreground">
                          {p.description ?? ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Schema + Example side by side */}
          {reqSchema && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-muted-foreground/60">
                  Request Body
                </h4>
                <SchemaProperties schema={reqSchema} spec={spec} />
              </div>
              {effectiveReqExample && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-muted-foreground/60">
                      Example
                    </h4>
                    <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-muted/60 dark:bg-muted/60">
                      <button
                        onClick={() => setActiveExampleTab("example")}
                        className={cn(
                          "px-1.5 py-0.5 rounded text-xs font-semibold transition-all",
                          activeExampleTab === "example"
                            ? "bg-card text-foreground shadow-sm"
                            : "text-muted-foreground/60"
                        )}
                      >
                        JSON
                      </button>
                      <button
                        onClick={() => setActiveExampleTab("curl")}
                        className={cn(
                          "px-1.5 py-0.5 rounded text-xs font-semibold transition-all",
                          activeExampleTab === "curl"
                            ? "bg-card text-foreground shadow-sm"
                            : "text-muted-foreground/60"
                        )}
                      >
                        cURL
                      </button>
                    </div>
                  </div>
                  {activeExampleTab === "example" ? (
                    <CodeBlock
                      code={JSON.stringify(effectiveReqExample, null, 2)}
                      title="Request"
                    />
                  ) : (
                    <CodeBlock code={curlSnippet} title="cURL" />
                  )}
                </div>
              )}
            </div>
          )}

          {/* GET endpoints — show curl even without a request body */}
          {!reqSchema && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-muted-foreground/60">
                Example Request
              </h4>
              <CodeBlock code={curlSnippet} title="cURL" />
            </div>
          )}

          {/* Response example */}
          {effectiveResExample && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-muted-foreground/60">
                Response — 200
              </h4>
              <CodeBlock
                code={JSON.stringify(effectiveResExample, null, 2)}
                title="JSON"
              />
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {Object.entries(endpoint.responses).map(
              ([code, res]: [string, any]) => (
                <span
                  key={code}
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold",
                    code.startsWith("2")
                      ? "kb-duotone-fill"
                      : code.startsWith("4")
                        ? "bg-red-500/10 text-red-500 dark:text-red-400"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {code}{" "}
                  <span className="font-normal text-xs opacity-80">
                    {res.description}
                  </span>
                </span>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Collapsible sidebar section ─────────────────────────────────────────────

function SidebarSection({
  category,
  groups,
  activeTag,
  onTagClick,
  onEndpointClick,
}: {
  category: string;
  groups: { tag: string; meta: TagMeta; endpoints: Endpoint[] }[];
  activeTag: string | null;
  onTagClick: (tag: string) => void;
  onEndpointClick: (ep: Endpoint) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const totalEndpoints = groups.reduce((acc, g) => acc + g.endpoints.length, 0);

  return (
    <div className="mb-1">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground/50 hover:text-muted-foreground dark:hover:text-white/50 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        {category}
        <span className="ml-auto text-xs font-semibold tabular-nums">
          {totalEndpoints}
        </span>
      </button>

      {expanded && (
        <div className="ml-1 space-y-0.5">
          {groups.map(({ tag, meta, endpoints: eps }) => {
            const Icon = meta.icon;
            const isActive = activeTag === tag;
            return (
              <div key={tag}>
                <button
                  onClick={() => onTagClick(tag)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold transition-colors",
                    isActive
                      ? "kb-duotone-fill"
                      : "text-foreground hover:bg-black/3 dark:hover:bg-white/3"
                  )}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{meta.label}</span>
                  <span className="ml-auto text-xs text-muted-foreground/40 font-normal tabular-nums">
                    {eps.length}
                  </span>
                </button>
                {isActive && (
                  <div className="ml-5 mt-0.5 mb-1 space-y-px">
                    {eps.map(ep => (
                      <button
                        key={ep.path + ep.method}
                        onClick={() => onEndpointClick(ep)}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-white hover:bg-black/2 dark:hover:bg-white/3 transition-colors w-full text-left"
                      >
                        <span
                          className={cn(
                            "text-[8px] font-extrabold w-7 shrink-0",
                            METHOD_STYLES[ep.method]?.text ?? ""
                          )}
                        >
                          {ep.method}
                        </span>
                        <span
                          className="truncate"
                          style={{
                            fontFamily: FONT_FAMILY.mono,
                            fontSize: "10px",
                          }}
                        >
                          {ep.path}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function KnowledgeApiDocs() {
  const { theme, toggleTheme } = useTheme();
  const searchString = useSearch();
  const isDark = theme === "dark";
  const [activeService, setActiveService] = useState<ServiceKey>("pipeline");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [openEndpoints, setOpenEndpoints] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const mainRef = useRef<HTMLDivElement>(null);

  // Favicon + title branding
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    const prevHref = link?.href;
    const prevTitle = document.title;
    if (link) link.href = "/favicon-api.svg";
    document.title = "API Explorer — Knowledge Domains";
    return () => {
      if (link && prevHref) link.href = prevHref;
      document.title = prevTitle;
    };
  }, []);

  const healthQ = trpc.knowledge.serviceHealth.useQuery(undefined, {
    retry: false,
    refetchInterval: 30_000,
  });
  const specQ = trpc.knowledge.openApiSpec.useQuery(
    { service: activeService },
    { retry: false, staleTime: 60_000 }
  );

  const activeServiceName =
    activeService === "vectorStore" ? "knowledge-api" : activeService;
  const knowledgeHref = useMemo(
    () =>
      buildKnowledgeWorkspaceHref(
        extractWorkspaceScopeFromSearch(searchString)
      ),
    [searchString]
  );
  const activeServiceHealth = healthQ.data?.services.find(
    s => s.name === activeServiceName
  );
  const status: ServiceStatus = healthQ.isLoading
    ? "checking"
    : activeServiceHealth?.ok
      ? "online"
      : "offline";
  const spec = specQ.data as Record<string, any> | undefined;
  const specInfo = spec?.info as Record<string, any> | undefined;
  const svcMeta = SERVICE_META[activeService];

  const endpoints = useMemo(() => parseEndpoints(spec), [spec]);

  const filteredEndpoints = useMemo(() => {
    if (!searchQuery.trim()) return endpoints;
    const q = searchQuery.toLowerCase();
    return endpoints.filter(
      ep =>
        ep.path.toLowerCase().includes(q) ||
        ep.summary.toLowerCase().includes(q) ||
        ep.tag.toLowerCase().includes(q) ||
        ep.method.toLowerCase().includes(q)
    );
  }, [endpoints, searchQuery]);

  const makeId = useCallback(
    (ep: Endpoint) =>
      `${ep.tag}-${ep.method.toLowerCase()}${ep.path.replace(/[/{}/]/g, "-")}`,
    []
  );

  const toggleEndpoint = useCallback((id: string) => {
    setOpenEndpoints(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAndScroll = useCallback(
    (ep: Endpoint) => {
      const id = makeId(ep);
      setOpenEndpoints(prev => new Set(prev).add(id));
      setActiveTag(ep.tag);
      setTimeout(() => {
        document
          .getElementById(id)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    },
    [makeId]
  );

  const expandAll = useCallback(() => {
    setOpenEndpoints(new Set(filteredEndpoints.map(makeId)));
  }, [filteredEndpoints, makeId]);

  const collapseAll = useCallback(() => {
    setOpenEndpoints(new Set());
  }, []);

  const tags = useMemo(
    () => Array.from(new Set(filteredEndpoints.map(e => e.tag))),
    [filteredEndpoints]
  );

  const grouped = useMemo(
    () =>
      tags.map(tag => ({
        tag,
        meta: TAG_META[tag] ?? { ...TAG_META.default, label: tag },
        endpoints: filteredEndpoints.filter(e => e.tag === tag),
      })),
    [tags, filteredEndpoints]
  );

  const categorized = useMemo(() => {
    return CATEGORIES.map(cat => ({
      category: cat,
      groups: grouped.filter(g => g.meta.category === cat),
    })).filter(c => c.groups.length > 0);
  }, [grouped]);

  // Reset state when switching services
  useEffect(() => {
    setActiveTag(null);
    setOpenEndpoints(new Set());
    setSearchQuery("");
  }, [activeService]);

  // Track active section on scroll
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const onScroll = () => {
      for (const t of tags) {
        const section = document.getElementById(`tag-${t}`);
        if (section) {
          const rect = section.getBoundingClientRect();
          if (rect.top < 200) setActiveTag(t);
        }
      }
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [tags]);

  if (specQ.isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
          <p className="text-xs text-muted-foreground/60">
            Loading API specification…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* ── Header ── */}
      <header className="flex items-center gap-3 px-5 h-12 border-b border-black/5 dark:border-border/30 bg-card dark:bg-card/80 shrink-0 z-20">
        <a
          href={knowledgeHref}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground/60 kb-duotone-text-hover transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Knowledge</span>
        </a>
        <div className="h-4 w-px bg-black/6 dark:bg-muted/80" />

        {/* Service selector */}
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted/60 dark:bg-muted/60">
          {(
            Object.entries(SERVICE_META) as [
              ServiceKey,
              typeof SERVICE_META.pipeline,
            ][]
          ).map(([key, meta]) => (
            <button
              key={key}
              onClick={() => setActiveService(key)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all",
                activeService === key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground/60 hover:text-foreground dark:hover:text-white/70"
              )}
            >
              {meta.label}
            </button>
          ))}
        </div>

        {specInfo?.version && (
          <span className="text-xs font-semibold px-1.5 py-0.5 rounded-md kb-duotone-fill uppercase tracking-wider">
            v{String(specInfo.version)}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Swagger link */}
          <a
            href={`http://localhost:${svcMeta.port}${svcMeta.swaggerPath}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg text-muted-foreground/50 kb-duotone-text-hover transition-colors"
            title="Open Swagger UI"
          >
            <ExternalLink className="w-3 h-3" /> Swagger
          </a>

          {/* Status indicator */}
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-xs font-medium",
              status === "online"
                ? "text-primary dark:text-primary"
                : status === "checking"
                  ? "text-primary"
                  : "text-muted-foreground/60"
            )}
          >
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                status === "online"
                  ? "bg-primary"
                  : status === "checking"
                    ? "bg-primary animate-pulse"
                    : "bg-muted-foreground"
              )}
            />
            {status === "online"
              ? "Live"
              : status === "checking"
                ? "Checking…"
                : "Offline"}
          </span>

          <div className="h-4 w-px bg-black/6 dark:bg-muted/80" />
          <button
            onClick={toggleTheme}
            className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground/50 hover:text-muted-foreground dark:hover:text-white/60 transition-colors"
            title={isDark ? "Light mode" : "Dark mode"}
          >
            {isDark ? (
              <Sun className="w-3.5 h-3.5" />
            ) : (
              <Moon className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </header>

      {/* ── Body: Sidebar + Content ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ── */}
        <nav className="w-56 shrink-0 border-r border-black/5 dark:border-border/30 bg-card dark:bg-card/70 overflow-y-auto py-3 px-2 hidden md:flex flex-col">
          {/* Search */}
          <div className="px-1 mb-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/50" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Filter endpoints…"
                className={cn(
                  "w-full pl-7 pr-2 py-1.5 text-[11px] rounded-lg",
                  "bg-muted dark:bg-muted/50",
                  "border border-transparent focus:border-primary/30",
                  "text-foreground dark:text-foreground",
                  "focus:outline-none transition-colors"
                )}
              />
            </div>
          </div>

          {/* Categorized tag groups */}
          <div className="flex-1 overflow-y-auto">
            {categorized.map(({ category, groups }) => (
              <SidebarSection
                key={category}
                category={category}
                groups={groups}
                activeTag={activeTag}
                onTagClick={tag => {
                  setActiveTag(tag);
                  document
                    .getElementById(`tag-${tag}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                onEndpointClick={expandAndScroll}
              />
            ))}
          </div>

          {/* Auth info */}
          <div className="mt-auto pt-3 px-1">
            <div className="rounded-lg border border-black/5 dark:border-border/30 p-2.5 bg-black/1 dark:bg-card/80">
              <div className="flex items-center gap-1.5 mb-1">
                <Lock className="w-3 h-3 text-primary" />
                <span className="text-[11px] font-bold text-foreground">
                  Auth
                </span>
              </div>
              <p className="text-xs text-muted-foreground dark:text-muted-foreground leading-relaxed">
                Bearer JWT with{" "}
                <code className="text-primary dark:text-primary text-xs font-semibold">
                  org_id
                </code>{" "}
                claim
              </p>
            </div>
          </div>
        </nav>

        {/* ── Main content ── */}
        <main ref={mainRef} className="flex-1 overflow-y-auto">
          <div className="px-6 sm:px-8 py-6 sm:py-8 space-y-8">
            {/* Hero + controls */}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-extrabold text-foreground mb-1">
                  {String(specInfo?.title || `${svcMeta.label} API`)}
                </h1>
                <p className="text-[13px] text-foreground dark:text-muted-foreground leading-relaxed max-w-lg">
                  {extractSummary(
                    String(specInfo?.summary || specInfo?.description || ""),
                    `OpenAPI specification for the ${svcMeta.label} service.`
                  )}
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs text-muted-foreground/50">
                    {filteredEndpoints.length} endpoints
                  </span>
                  <span className="text-xs text-muted-foreground/50">
                    {tags.length} groups
                  </span>
                </div>
                {specInfo?.description && (
                  <SpecDescription text={String(specInfo.description)} />
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={expandAll}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg text-muted-foreground/50 hover:text-foreground dark:hover:text-white/70 bg-muted/60 dark:bg-muted/60 transition-colors"
                >
                  <ChevronsUpDown className="w-3 h-3" /> Expand
                </button>
                <button
                  onClick={collapseAll}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg text-muted-foreground/50 hover:text-foreground dark:hover:text-white/70 bg-muted/60 dark:bg-muted/60 transition-colors"
                >
                  <ChevronsDownUp className="w-3 h-3" /> Collapse
                </button>
              </div>
            </div>

            {/* Endpoint groups */}
            {grouped.map(({ tag, meta, endpoints: eps }) => {
              const Icon = meta.icon;
              return (
                <section key={tag} id={`tag-${tag}`} className="scroll-mt-20">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-4 h-4 text-primary" />
                    <h2 className="text-base font-extrabold text-foreground">
                      {meta.label}
                    </h2>
                    <span className="text-xs text-muted-foreground/40 tabular-nums">
                      {eps.length}
                    </span>
                  </div>
                  <p className="text-[12px] text-muted-foreground dark:text-muted-foreground mb-4">
                    {meta.description}
                  </p>
                  <div className="space-y-2.5">
                    {eps.map(ep => (
                      <EndpointCard
                        key={ep.path + ep.method}
                        endpoint={ep}
                        id={makeId(ep)}
                        open={openEndpoints.has(makeId(ep))}
                        onToggle={() => toggleEndpoint(makeId(ep))}
                        spec={spec ?? {}}
                      />
                    ))}
                  </div>
                </section>
              );
            })}

            {filteredEndpoints.length === 0 && !specQ.isLoading && (
              <div className="text-center py-16">
                <BookOpen className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery
                    ? "No endpoints match your search"
                    : "No endpoints available"}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {searchQuery
                    ? "Try a different search term."
                    : status === "offline"
                      ? "The service is offline."
                      : "Could not load the OpenAPI specification."}
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
