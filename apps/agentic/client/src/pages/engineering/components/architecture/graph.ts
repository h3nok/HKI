/**
 * Architecture graph data — single source of truth for both the runtime
 * contract and the reference architecture diagrams. Pure data, no React.
 */

import type { ComponentType } from "react";
import {
  ShieldCheck,
  Network,
  Search,
  Database,
  GitBranch,
  Wrench,
  Clock,
  BookOpen,
  Users,
  FileCheck,
  Share2,
  Radar,
} from "lucide-react";

import type { PlaneId } from "./planes";

export type ViewMode = "runtime" | "publication" | "admin";

export type ArchNode = {
  id: string;
  label: string;
  short: string;
  plane: PlaneId;
  /** Layer index (0 = top-most band of the plane). */
  layer: number;
  /** Position within layer (0..n-1, left to right). */
  slot: number;
  icon: ComponentType<{ className?: string }>;
  job: string;
  enforces: string;
  rejects: string;
  surface: string;
  /** Which view modes light this node up as on-path. */
  highlight: readonly ViewMode[];
};

export type ArchEdge = {
  from: string;
  to: string;
  label?: string;
  mode: ViewMode;
  /** Edge style — `dashed` denotes async / cache reads. */
  kind?: "solid" | "dashed";
};

/* ─── Nodes (data only) ──────────────────────────────────────────────── */

export const ARCH_NODES: readonly ArchNode[] = [
  // Edge plane
  {
    id: "client",
    label: "Client / Caller",
    short: "Identity in",
    plane: "edge",
    layer: 0,
    slot: 0,
    icon: Users,
    job: "User, agent, or upstream service initiates a request carrying its own identity (OIDC, API key, mTLS).",
    enforces:
      "The client never selects scope. It states intent — the gateway resolves the binding active domain.",
    rejects: "UI-supplied scope strings becoming the trusted active domain.",
    surface: "Authorization: Bearer …",
    highlight: ["runtime", "publication", "admin"],
  },
  {
    id: "gateway",
    label: "Gateway / BFF",
    short: "Mint signed envelope",
    plane: "edge",
    layer: 1,
    slot: 0,
    icon: ShieldCheck,
    job: "Authenticates the caller, resolves exactly one active domain, and signs a short-lived HKI envelope.",
    enforces:
      "Active domain is decided here, once. The signed envelope is the only source of truth downstream.",
    rejects:
      "Defaulting to global, picking the first authorized domain, or trusting a body-scope override.",
    surface: "mintEnvelope({ orgId, activeDomain, … })",
    highlight: ["runtime", "publication", "admin"],
  },

  // Runtime plane
  {
    id: "orchestrator",
    label: "Orchestrator",
    short: "Carries the envelope",
    plane: "runtime",
    layer: 0,
    slot: 0,
    icon: Network,
    job: "ReAct loop or workflow engine that drives retrieval, tool calls, and response composition.",
    enforces:
      "Forwards the envelope unchanged. Sub-agent handoffs mint a child envelope with equal or narrower scope.",
    rejects:
      "Passing a parent envelope verbatim to a sub-agent or letting tool arguments broaden scope.",
    surface: "agent.run(envelope=child)",
    highlight: ["runtime"],
  },
  {
    id: "retrieval",
    label: "Retrieval",
    short: "Exact-domain read",
    plane: "runtime",
    layer: 0,
    slot: 1,
    icon: Search,
    job: "Vector + keyword search against the document store with re-ranking and citations.",
    enforces:
      "Reads filter on equality with envelope.active_domain. No partial match, no global fallback.",
    rejects:
      "Applying the domain filter only after rewrite/expansion or falling back to a global index when empty.",
    surface: "store.search(domain=env.active, strict=True)",
    highlight: ["runtime"],
  },
  {
    id: "graph",
    label: "Graph",
    short: "Label-checked edges",
    plane: "runtime",
    layer: 0,
    slot: 2,
    icon: GitBranch,
    job: "Knowledge graph traversal expands context around retrieved entities.",
    enforces:
      "Every node and edge carries a domain label. Unlabeled or different-domain hops fail closed.",
    rejects:
      "Following a derived edge into another domain because it was created without provenance.",
    surface: "graph.traverse(require_label=env.active)",
    highlight: ["runtime"],
  },
  {
    id: "tools",
    label: "Tools / MCP",
    short: "Envelope scope",
    plane: "runtime",
    layer: 0,
    slot: 3,
    icon: Wrench,
    job: "Tool invocations — read, write, summarize, trigger workflow — through an MCP gateway.",
    enforces:
      "Tool catalog is filtered by domain. Tool arguments cannot override envelope scope.",
    rejects:
      "{tool: 'search_documents', args: {scope: 'global'}} silently broadening visibility.",
    surface: "evaluateGatewayTarget(envelope, tool)",
    highlight: ["runtime"],
  },
  {
    id: "cache",
    label: "Semantic Cache",
    short: "Domain-bound key",
    plane: "runtime",
    layer: 1,
    slot: 0,
    icon: Database,
    job: "Caches embeddings, retrievals, and completions to reduce cost and latency.",
    enforces:
      "Keys include {org, active_domain, op, model, ctx_version, query_fp}. Cross-domain hits are impossible.",
    rejects:
      "Keying on query text alone — the classic cause of cross-tenant cache bleed (T01).",
    surface: "deriveHkiCacheKey({ envelope, op, input })",
    highlight: ["runtime"],
  },
  {
    id: "jobs",
    label: "Jobs & Memory",
    short: "Labels persist",
    plane: "runtime",
    layer: 1,
    slot: 1,
    icon: Clock,
    job: "Async jobs (ingest, eval, summarize) and conversation memory persisted across turns.",
    enforces:
      "Jobs and memory rows carry the originating domain. A job in A cannot resume into B.",
    rejects:
      "Resuming an async job without re-validating its envelope or re-attaching the original scope.",
    surface: "jobs.create(envelope, …)",
    highlight: ["runtime"],
  },

  // Publication plane
  {
    id: "source",
    label: "Curated Source",
    short: "Master artifact",
    plane: "publication",
    layer: 0,
    slot: 0,
    icon: BookOpen,
    job: "Authoritative artifact (policy, playbook, ontology) maintained by a content owner.",
    enforces:
      "Lives in the publication plane. Has no implicit runtime visibility from any domain.",
    rejects:
      "Treating an unscoped 'global' artifact as readable from runtime queries.",
    surface: "publications.source",
    highlight: ["publication"],
  },
  {
    id: "publish",
    label: "Publication Workflow",
    short: "Authorized fan-out",
    plane: "publication",
    layer: 0,
    slot: 1,
    icon: Share2,
    job: "Explicit, audited workflow that materializes the source into per-domain copies.",
    enforces:
      "Each materialized copy is a new domain-labeled artifact with provenance back to the source.",
    rejects:
      "Sharing knowledge by leaving an artifact unscoped and relying on a downstream wildcard.",
    surface: "publish.fanout(source, [domains])",
    highlight: ["publication"],
  },
  {
    id: "domain-copy",
    label: "Per-Domain Copy",
    short: "Runtime-readable",
    plane: "publication",
    layer: 0,
    slot: 2,
    icon: FileCheck,
    job: "Domain-scoped derivative that the runtime plane can actually read.",
    enforces:
      "Indistinguishable from a domain-native artifact at read time. Provenance preserved in metadata.",
    rejects:
      "Implicit inheritance — runtime never reads the source directly, only the materialized copy.",
    surface: "store.put(domain=…, provenance=src)",
    highlight: ["publication"],
  },

  // Admin plane
  {
    id: "admin",
    label: "Admin / Audit",
    short: "Cross-domain views",
    plane: "admin",
    layer: 0,
    slot: 0,
    icon: Radar,
    job: "Compliance, governance, and conformance evidence — summaries across every domain.",
    enforces:
      "Lives on a separate route plane. Admin queries cannot be reached from runtime endpoints.",
    rejects:
      "Reusing an admin cross-domain query inside a runtime route 'just for reporting'.",
    surface: "admin.crossDomainSummary()",
    highlight: ["admin"],
  },
];

/* ─── Edges (data only) ──────────────────────────────────────────────── */

export const ARCH_EDGES: readonly ArchEdge[] = [
  // Runtime
  { from: "client", to: "gateway", mode: "runtime", label: "auth" },
  { from: "gateway", to: "orchestrator", mode: "runtime", label: "envelope" },
  { from: "orchestrator", to: "retrieval", mode: "runtime" },
  { from: "retrieval", to: "graph", mode: "runtime" },
  { from: "graph", to: "tools", mode: "runtime" },
  { from: "retrieval", to: "cache", mode: "runtime", kind: "dashed" },
  { from: "orchestrator", to: "jobs", mode: "runtime", kind: "dashed" },

  // Publication
  { from: "client", to: "gateway", mode: "publication" },
  { from: "gateway", to: "publish", mode: "publication", label: "authorize" },
  { from: "source", to: "publish", mode: "publication" },
  {
    from: "publish",
    to: "domain-copy",
    mode: "publication",
    label: "materialize",
  },
  {
    from: "domain-copy",
    to: "retrieval",
    mode: "publication",
    kind: "dashed",
    label: "read at runtime",
  },

  // Admin
  { from: "client", to: "gateway", mode: "admin" },
  { from: "gateway", to: "admin", mode: "admin", label: "admin route" },
];

/* ─── View metadata ──────────────────────────────────────────────────── */

import { Lock } from "lucide-react";

export const VIEW_META: Record<
  ViewMode,
  {
    label: string;
    tagline: string;
    icon: ComponentType<{ className?: string }>;
  }
> = {
  runtime: {
    label: "Runtime path",
    tagline:
      "One signed envelope, decided at the gateway, carried unchanged through every store and tool.",
    icon: ShieldCheck,
  },
  publication: {
    label: "Publication path",
    tagline:
      "Cross-domain sharing is an explicit fan-out — never a fallback. Runtime reads only the materialized copy.",
    icon: Share2,
  },
  admin: {
    label: "Admin path",
    tagline:
      "Cross-domain visibility lives on a separate plane that runtime endpoints cannot reach.",
    icon: Lock,
  },
};
