/**
 * Landing page constants — single source of truth for the public HKI site.
 */

import {
  BookOpen,
  BrainCircuit,
  Cloud,
  Cpu,
  Database,
  Eye,
  type LucideIcon,
  MessageSquare,
  Palette,
  Shield,
  Settings,
  Zap,
  Search,
  Network,
  FileText,
  Lock,
  BarChart3,
  Wrench,
} from "lucide-react";

// ── Token aliases ───────────────────────────────────────────────────────
export const COLORS = {
  iris: "var(--hki-iris-500)",
  pulse: "var(--hki-iris-500)",
  success: "var(--hki-iris-500)",
  warning: "var(--hki-iris-500)",
  info: "var(--hki-iris-500)",
  violet: "var(--hki-iris-500)",
  cyan: "var(--hki-iris-500)",
  orange: "var(--hki-iris-500)",
} as const;

// ── Motion preset ───────────────────────────────────────────────────────

export const EASE = [0.22, 1, 0.36, 1] as const;

// ═══════════════════════════════════════════════════════════════════════════
// 1. HKI FRAMEWORK SURFACE
// ═══════════════════════════════════════════════════════════════════════════

export interface StackLayer {
  id: string;
  label: string;
  subtitle: string;
  useCase: string;
  description: string;
  icon: LucideIcon;
  color: string;
  capabilities: string[];
  status: "live" | "api" | "planned";
  selfService?: string[];
  link?: string;
  linkLabel?: string;
  techStack?: string[];
  hasUI?: boolean;
}

export const STACK_LAYERS: readonly StackLayer[] = [
  {
    id: "aiops",
    label: "Conformance",
    subtitle: "Prove every runtime path preserves the active domain.",
    useCase:
      "Run missing-scope, global-scope, cache, graph, and tool leak tests.",
    description:
      "A repeatable test harness for validating HKI behavior before release.",
    icon: Eye,
    color: COLORS.cyan,
    status: "live",
    capabilities: [
      "Scope Audits",
      "Leakage Tests",
      "Release Gates",
      "Trace Proofs",
      "Readiness Reports",
      "Admin Separation",
      "Policy Evidence",
    ],
    selfService: ["Scope Audits", "Leakage Tests", "Readiness Reports"],
    techStack: ["Vitest", "Pytest", "Playwright"],
    hasUI: true,
    link: "/admin",
    linkLabel: "View Audit Surface",
  },
  {
    id: "agent",
    label: "Runtime Contract",
    subtitle: "One request, one active domain, no implicit global visibility.",
    useCase: "Issue signed envelopes and bind every downstream operation.",
    description: "The executable isolation law for agentic request paths.",
    icon: BrainCircuit,
    color: COLORS.iris,
    status: "live",
    capabilities: [
      "Scope Envelope",
      "Fail Closed",
      "Exact Domain",
      "Policy Packs",
      "Purpose Binding",
      "Risk Tiers",
    ],
    selfService: ["Scope Envelope", "Fail Closed", "Exact Domain"],
    techStack: ["JWT", "tRPC", "FastAPI"],
    hasUI: true,
    link: "/chat?scope=hki-reference",
    linkLabel: "Inspect Runtime",
  },
  {
    id: "model",
    label: "Model Flexibility",
    subtitle: "Access any model. Benchmark every option. Ship what works.",
    useCase: "Benchmark model choices before rolling out to production.",
    description:
      "Swap models without rewriting code. Always deploy the best option.",
    icon: Cpu,
    color: COLORS.violet,
    status: "planned",
    capabilities: [
      "Multi-Model Serving",
      "Benchmarking",
      "Model Registry",
      "Fine-Tuning",
      "Guardrails & Filters",
    ],
  },
  {
    id: "knowledge",
    label: "Knowledge Isolation",
    subtitle:
      "Every document, chunk, graph node, job, and review has a domain.",
    useCase:
      "Enforce exact-domain retrieval across vector, graph, and review flows.",
    description:
      "Domain labels are preserved from ingestion through answer synthesis.",
    icon: BookOpen,
    color: COLORS.success,
    status: "live",
    capabilities: [
      "Artifact Labels",
      "Vector Filters",
      "Graph Boundaries",
      "Review Scope",
      "Release Scope",
      "Citation Scope",
      "Publication",
    ],
    selfService: [
      "Artifact Labels",
      "Vector Filters",
      "Graph Boundaries",
      "Publication",
    ],
    techStack: ["pgvector", "Neo4j", "Pub/Sub"],
    hasUI: true,
    link: "/welcome",
    linkLabel: "Open Knowledge Lab",
  },
  {
    id: "data",
    label: "Artifact Stores",
    subtitle: "Storage is shared only physically, never semantically.",
    useCase: "Bind reads, writes, cache entries, jobs, and traces to domain.",
    description:
      "Adapters for relational, vector, graph, object, cache, and analytics stores.",
    icon: Database,
    color: COLORS.cyan,
    status: "api",
    capabilities: [
      "Relational Labels",
      "Vector Partitions",
      "Graph Labels",
      "Object Prefixes",
      "Domain Cache Keys",
    ],
    techStack: ["MySQL", "AlloyDB", "Redis"],
    hasUI: false,
  },
  {
    id: "cloud",
    label: "Reference Runtime",
    subtitle: "A deployable implementation for real enterprise agent stacks.",
    useCase:
      "Run HKI across BFF, orchestrator, retrieval, ingestion, and analytics.",
    description:
      "A production-shaped reference app that proves the isolation model end to end.",
    icon: Cloud,
    color: COLORS.info,
    status: "api",
    capabilities: [
      "BFF Gateway",
      "Orchestrator",
      "Knowledge API",
      "Ingestion",
      "Analytics",
      "Kubernetes",
    ],
    techStack: ["GKE", "Docker", "OpenTelemetry"],
    hasUI: false,
  },
  {
    id: "gateway",
    label: "MCP & Tool Isolation",
    subtitle: "Tools inherit the same active domain as retrieval and memory.",
    useCase: "Gate tool catalogs, arguments, calls, caches, and audit records.",
    description:
      "A gateway pattern for making MCP and enterprise adapters HKI-conformant.",
    icon: Network,
    color: COLORS.orange,
    status: "live",
    capabilities: [
      "Tool Catalogs",
      "Policy Checks",
      "Argument Narrowing",
      "Adapter Scope",
      "Tool Audit",
      "Domain Quotas",
    ],
    techStack: ["MCP", "OPA", "LiteLLM"],
    hasUI: true,
    link: "/engineering",
    linkLabel: "Gateway Design",
  },
  {
    id: "experience",
    label: "Developer Experience",
    subtitle: "Tokenized UI and operator surfaces for isolation-first systems.",
    useCase:
      "Embed scope status, readiness, traces, and publication workflows.",
    description:
      "Shared React primitives for making isolation state visible and usable.",
    icon: Palette,
    color: COLORS.violet,
    status: "live",
    capabilities: [
      "Design Tokens",
      "HKI Primitives",
      "Domain Icons",
      "Defensive UI",
      "Agent Runtime Components",
      "Theme System",
    ],
    selfService: [
      "Design Tokens",
      "HKI Primitives",
      "Domain Icons",
      "Defensive UI",
      "Agent Runtime Components",
    ],
    techStack: ["React", "Tailwind CSS", "Radix UI"],
    hasUI: true,
    link: "/ui-showcase",
    linkLabel: "View UI Showcase",
  },
] as const;

// ═══════════════════════════════════════════════════════════════════════════
// 2. ROLES
// ═══════════════════════════════════════════════════════════════════════════

export interface Role {
  persona: string;
  title: string;
  icon: LucideIcon;
  color: string;
  actions: { icon: LucideIcon; text: string }[];
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. STATS — counter tiles for the landing section
// ═══════════════════════════════════════════════════════════════════════════

export const STATS = [
  { value: "7", label: "Framework Surfaces" },
  { value: "30+", label: "Capabilities" },
  { value: "3", label: "User Roles" },
  { value: "100%", label: "Vendor Neutral" },
] as const;

// ═══════════════════════════════════════════════════════════════════════════
// 4. CAPABILITIES — orbiting nodes for the architecture ring
// ═══════════════════════════════════════════════════════════════════════════

export const CAPABILITIES = [
  { label: "Knowledge", icon: BookOpen },
  { label: "Reasoning", icon: BrainCircuit },
  { label: "Search", icon: Search },
  { label: "Guardrails", icon: Shield },
  { label: "Tools", icon: Wrench },
  { label: "Analytics", icon: BarChart3 },
] as const;

export const ROLES: readonly Role[] = [
  {
    persona: "End User",
    title: "Ask inside one active domain and get scoped evidence back.",
    icon: MessageSquare,
    color: COLORS.iris,
    actions: [
      { icon: Search, text: "Retrieve only artifacts in the active domain" },
      { icon: Zap, text: "Keep rewrites, tools, memory, and cache scoped" },
      { icon: Shield, text: "Fail closed when scope is missing or ambiguous" },
    ],
  },
  {
    persona: "Knowledge Manager",
    title: "Publish shared knowledge without weakening boundaries.",
    icon: BookOpen,
    color: COLORS.success,
    actions: [
      {
        icon: FileText,
        text: "Label every document, chunk, review, and release",
      },
      { icon: Network, text: "Reject unlabeled graph edges and derived nodes" },
      { icon: BarChart3, text: "Track null-scope and publication readiness" },
    ],
  },
  {
    persona: "Platform Operator",
    title: "Certify agentic systems before production release.",
    icon: Settings,
    color: COLORS.cyan,
    actions: [
      { icon: Eye, text: "Audit active domain on every trace and tool call" },
      { icon: Lock, text: "Separate runtime-plane and admin-plane traffic" },
      { icon: Wrench, text: "Run HKI conformance gates in CI and release" },
    ],
  },
] as const;
