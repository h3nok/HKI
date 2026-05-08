import { Database, GitBranch, Route, Workflow } from "lucide-react";
import type { RiskScenario } from "../components/RiskCard";

export const RISK_SCENARIOS: readonly RiskScenario[] = [
  {
    id: "rewrite",
    title: "Query Rewrite Drift",
    summary:
      "The agent rewrites a narrow question into a broader search; the retriever then surfaces a semantically relevant artifact from another business domain.",
    enterpriseImpact:
      "Sensitive policies, product plans, or regulated procedures can influence an answer outside the authorized operating context.",
    hkiControl:
      "The signed active domain is bound before rewrite and enforced at every retrieval step.",
    severity: "high",
    icon: Route,
    weakPath: ["Prompt", "Rewrite", "Broad search", "Cross-domain result"],
    hkiPath: [
      "Gateway signs domain",
      "Rewrite stays bound",
      "Exact-domain read",
      "Scoped answer",
    ],
  },
  {
    id: "cache",
    title: "Semantic Cache Replay",
    summary:
      "A fast cache hit reuses an answer for a similar question without proving the same domain — the cache key uses org + query text but not active domain or operation.",
    enterpriseImpact:
      "One team can receive cached evidence shaped by another team's documents, even when storage filters are correct.",
    hkiControl:
      "Cache keys include organization, active domain, operation, model, and context version.",
    severity: "high",
    icon: Database,
    weakPath: [
      "User asks",
      "Cache lookup",
      "Query-only key",
      "Wrong-domain answer",
    ],
    hkiPath: [
      "User asks",
      "Domain-bound key",
      "No unsafe hit",
      "Fresh scoped retrieval",
    ],
  },
  {
    id: "graph",
    title: "Derived Graph Jump",
    summary:
      "Graph edges created offline connect entities across domains without preserving the originating label, so a traversal follows a useful neighbor before any label check.",
    enterpriseImpact:
      "Agent reasoning can blend supply chain, pharmacy, finance, or legal facts into one invisible context.",
    hkiControl:
      "Nodes and edges carry domain labels; unlabeled or different-domain traversals fail closed.",
    severity: "critical",
    icon: GitBranch,
    weakPath: [
      "A-labeled node",
      "Unlabeled edge",
      "B-labeled node",
      "Mixed reasoning",
    ],
    hkiPath: [
      "A-labeled node",
      "Edge label check",
      "Mismatch rejected",
      "Domain-local graph",
    ],
  },
  {
    id: "tools",
    title: "Tool Scope Override",
    summary:
      "A tool call accepts a domain argument from natural language or model output, so tool arguments become more trusted than the gateway-selected execution context.",
    enterpriseImpact:
      "Autonomous agents can act across value streams: reading, writing, summarizing, or triggering workflows outside their active domain.",
    hkiControl:
      "Tools inherit scope from the signed envelope; model-supplied scope is ignored or rejected.",
    severity: "critical",
    icon: Workflow,
    weakPath: [
      "Agent plan",
      "Tool argument",
      "Model picks scope",
      "Cross-domain action",
    ],
    hkiPath: [
      "Agent plan",
      "Envelope scope",
      "Tool narrows only",
      "Scoped action",
    ],
  },
] as const;
