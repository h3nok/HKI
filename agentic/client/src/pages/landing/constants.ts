/**
 * Landing page constants — single source of truth.
 *
 * Two data sets:
 *   1. Architecture Stack — the 6-layer platform model
 *   2. Roles — persona-based feature highlights
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

// ── Brand shorthand ─────────────────────────────────────────────────────

export const BLUE = "var(--primary)";
export const RED = "var(--secondary)";

// ── Motion preset ───────────────────────────────────────────────────────

export const EASE = [0.22, 1, 0.36, 1] as const;

// ═══════════════════════════════════════════════════════════════════════════
// 1. ARCHITECTURE STACK
// ═══════════════════════════════════════════════════════════════════════════

export interface StackLayer {
  id: string;
  label: string;
  subtitle: string; // strategic one-liner shown on card
  useCase: string; // concrete "best for" guidance shown on card
  description: string; // business outcome narrative
  icon: LucideIcon;
  color: string;
  capabilities: string[];
  status: "live" | "api" | "planned"; // readiness state shown on card
  selfService?: string[]; // capabilities available for self-service today
  link?: string; // in-app link
  linkLabel?: string; // CTA label
  techStack?: string[]; // GCP services powering this layer
  hasUI?: boolean; // has self-service UI available
}

export const STACK_LAYERS: readonly StackLayer[] = [
  {
    id: "aiops",
    label: "AI Operations",
    subtitle: "Know what your AI is doing — before anyone asks.",
    useCase: "Audit traces, score quality, and certify production agents.",
    description:
      "Full audit trails from every conversation to every model decision.",
    icon: Eye,
    color: "#F59E0B",
    status: "live",
    capabilities: [
      "Governance",
      "Evaluation",
      "Certification",
      "Registry",
      "Human Feedback",
      "Security",
      "Observability",
    ],
    selfService: ["Evaluation", "Human Feedback", "Observability"],
    techStack: ["Cloud SQL", "Cloud Trace", "Cloud Monitoring"],
    hasUI: true,
    link: "/admin",
    linkLabel: "Admin Dashboard",
  },
  {
    id: "agent",
    label: "Agent",
    subtitle: "Orchestrated reasoning that plans, acts, and learns.",
    useCase: "Run multi-step tasks that call tools and reason over context.",
    description: "A system that plans, acts, and learns — not a chatbot.",
    icon: BrainCircuit,
    color: BLUE,
    status: "live",
    capabilities: [
      "Orchestration",
      "Reasoning",
      "Tool Integration",
      "Memory",
      "Prompt Registry",
      "Experimentation",
    ],
    selfService: ["Prompt Registry", "Experimentation"],
    techStack: ["GKE", "Vertex AI", "PostgreSQL"],
    hasUI: true,
    link: "/chat",
    linkLabel: "Try Live Agent",
  },
  {
    id: "model",
    label: "Model Flexibility",
    subtitle: "Access any model. Benchmark every option. Ship what works.",
    useCase: "Benchmark model choices before rolling out to production.",
    description:
      "Swap models without rewriting code. Always deploy the best option.",
    icon: Cpu,
    color: "#8B5CF6",
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
    label: "Knowledge Engine",
    subtitle: "Your SOPs, policies, and guides — searchable in seconds.",
    useCase: "Ingest SOPs and policies, then retrieve grounded context fast.",
    description:
      "Static documents become a searchable organizational brain. Self-service ingestion for every team.",
    icon: BookOpen,
    color: "#10B981",
    status: "live",
    capabilities: [
      "Document Ingestion",
      "Semantic Chunking",
      "Knowledge Graph",
      "Vector Search",
      "Corrective RAG",
      "Metadata Management",
      "Knowledge Synthesis",
    ],
    selfService: [
      "Document Ingestion",
      "Knowledge Graph",
      "Vector Search",
      "Metadata Management",
    ],
    techStack: ["Vertex AI Search", "Cloud Storage", "Pub/Sub"],
    hasUI: true,
    link: "/welcome",
    linkLabel: "Knowledge",
  },
  {
    id: "data",
    label: "Data Infrastructure",
    subtitle: "Enterprise data, AI-ready — no migration required.",
    useCase: "Store vectors, entities, and artifacts backing every response.",
    description:
      "Enterprise data, AI-ready. You handle the strategy — the platform handles retrieval.",
    icon: Database,
    color: "#06B6D4",
    status: "api",
    capabilities: [
      "Vector Store",
      "Graph Store",
      "Object Storage",
      "Data Governance",
      "Data Pipelines",
    ],
    techStack: ["Cloud SQL", "Firestore", "Cloud Storage"],
    hasUI: false,
  },
  {
    id: "cloud",
    label: "Cloud & Scale",
    subtitle: "Built for HKI scale. Runs on GCP. Secure by default.",
    useCase: "Operate secure, autoscaled runtime with IAM and observability.",
    description:
      "The infrastructure decision you make once. Secure, scalable, observable.",
    icon: Cloud,
    color: RED,
    status: "api",
    capabilities: [
      "Auto-Scale Runtime",
      "SSO & IAM",
      "API Management",
      "Event Queue",
      "Observability",
      "Tool Gateway",
    ],
    techStack: ["GKE", "IAP", "Cloud Load Balancing"],
    hasUI: false,
  },
  {
    id: "gateway",
    label: "AI Gateway",
    subtitle: "Unified LLM proxy. Every call routed, governed, observed.",
    useCase: "Route model traffic with cost controls and provider failover.",
    description:
      "LiteLLM-powered gateway fronting all model traffic. Smart routing across Gemini, OpenAI, and Vertex — with rate limits, cost caps, and full audit trails.",
    icon: Network,
    color: "#F97316",
    status: "live",
    capabilities: [
      "LLM Routing",
      "Rate Limiting",
      "Cost Controls",
      "Audit Logging",
      "Load Balancing",
      "Streaming Proxy",
    ],
    techStack: ["LiteLLM", "Load Balancing", "Vertex AI"],
    hasUI: true,
    link: "https://aigateway.cilabs.np.hki.com/ui/",
    linkLabel: "Open Gateway Dashboard",
  },
  {
    id: "experience",
    label: "Experience Layer",
    subtitle:
      "HKI-native UI primitives, design tokens, and defensive patterns.",
    useCase: "Ship consistent HKI-native agent UX across all surfaces.",
    description:
      "The shared UI foundation across every platform surface — HKI brand tokens, accessible component primitives, defensive UI patterns, agentic components, and the value stream icon system.",
    icon: Palette,
    color: "#6366F1",
    status: "live",
    capabilities: [
      "Design Tokens",
      "HKI Primitives",
      "Value Stream Icons",
      "Defensive UI",
      "Agentic Components",
      "Theme System",
    ],
    selfService: [
      "Design Tokens",
      "HKI Primitives",
      "Value Stream Icons",
      "Defensive UI",
      "Agentic Components",
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
  { value: "7", label: "Platform Layers" },
  { value: "30+", label: "Capabilities" },
  { value: "3", label: "User Roles" },
  { value: "100%", label: "GCP Native" },
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
    title: "The right answer, one question away.",
    icon: MessageSquare,
    color: "#005DAA",
    actions: [
      { icon: Search, text: "Search across every department, instantly" },
      { icon: Zap, text: "Grounded answers with source citations" },
      { icon: Shield, text: "Responses checked before they reach you" },
    ],
  },
  {
    persona: "Knowledge Manager",
    title: "Turn your docs into organizational intelligence.",
    icon: BookOpen,
    color: "#10B981",
    actions: [
      { icon: FileText, text: "Self-service document ingestion, no IT ticket" },
      { icon: Network, text: "Automatic entity and relationship graphs" },
      { icon: BarChart3, text: "Retrieval quality metrics and feedback loops" },
    ],
  },
  {
    persona: "Platform Admin",
    title: "Ship fast. Stay compliant. Sleep soundly.",
    icon: Settings,
    color: "#F59E0B",
    actions: [
      { icon: Eye, text: "Live traces for every conversation and model call" },
      { icon: Lock, text: "Guardrail policies enforced across every agent" },
      { icon: Wrench, text: "Tool registry and MCP capability management" },
    ],
  },
] as const;
