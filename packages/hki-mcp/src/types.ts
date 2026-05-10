import type { HkiEnvelope, HkiValidationResult } from "@hki/runtime";

/**
 * Minimal MCP Tool definition.
 * Based on the Model Context Protocol 1.0 spec.
 */
export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * MCP Resource definition.
 * Resources are read-only data sources that MCP clients can reference.
 */
export interface McpResource {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

/**
 * MCP Prompt template.
 * Prompts are reusable instruction templates with optional arguments.
 */
export interface McpPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

/**
 * MCP Tool Call result.
 */
export interface McpToolResult {
  type: "text" | "image" | "resource" | "error";
  text?: string;
  data?: string;
  uri?: string;
  mimeType?: string;
}

/**
 * Registry of domain-published tools, resources, and prompts.
 * The gateway populates this when initializing the HKI-MCP wrapper.
 *
 * Example:
 * ```ts
 * {
 *   "iris": {
 *     tools: [{ name: "search_iris_docs", ... }],
 *     resources: [{ uri: "iris://vault/contracts", ... }],
 *     prompts: [{ name: "iris_incident_response", ... }]
 *   },
 *   "pulse": {
 *     tools: [{ name: "search_pulse_docs", ... }],
 *     resources: [],
 *     prompts: []
 *   }
 * }
 * ```
 */
export interface DomainRegistry {
  [domain: string]: {
    tools?: McpTool[];
    resources?: McpResource[];
    prompts?: McpPrompt[];
  };
}

/**
 * Audit record for an HKI-MCP decision.
 * Used for compliance and debugging.
 */
export interface HkiMcpAuditRecord {
  timestamp: string;
  envelope_id: string;
  active_domain: string;
  operation:
    | "tools.list"
    | "resources.list"
    | "prompts.list"
    | "tools.call"
    | "resources.read";
  tool_name?: string;
  resource_uri?: string;
  allowed: boolean;
  reason?: string;
}

/**
 * Options for creating an HKI-aware MCP server wrapper.
 */
export interface HkiMcpServerOptions {
  /**
   * The domain registry mapping each active_domain to its tools/resources/prompts.
   * Required for filtering.
   */
  domainRegistry: DomainRegistry;

  /**
   * Optional callback to record audit decisions.
   * Called after every operation decision (allow or reject).
   */
  onAudit?: (record: HkiMcpAuditRecord) => void | Promise<void>;

  /**
   * If true, log decisions to console (for debugging).
   */
  debug?: boolean;
}

/**
 * Validation context: the active envelope + the operation being performed.
 */
export interface HkiMcpValidationContext {
  envelope: HkiEnvelope;
  validation: HkiValidationResult;
  operation: HkiMcpAuditRecord["operation"];
}

/**
 * Result of domain filtering for a tool/resource/prompt.
 */
export interface FilteredRegistry {
  tools: McpTool[];
  resources: McpResource[];
  prompts: McpPrompt[];
}
