import { computeCriticalPath, summarizeRun } from "@myelin/core";
import { apiClient } from "./client.js";

export const tools = {
  list_runs: {
    description:
      "List recent agent execution runs. Filter by domain or status.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Max runs to return (default 20)",
          default: 20,
        },
        domain: { type: "string", description: "Filter by HKI domain" },
        status: {
          type: "string",
          enum: ["running", "success", "error"],
          description: "Filter by status",
        },
      },
    },
    handler: async (args: {
      limit?: number;
      domain?: string;
      status?: string;
    }) => {
      const { runs } = await apiClient.listRuns(args);
      return {
        runs: runs.map(r => ({
          id: r.id,
          query: r.query.slice(0, 100),
          status: r.status,
          domain: r.hki_domain,
          model: r.model,
          confidence: r.confidence,
          nodes: r.node_count,
          started: r.started_at,
        })),
        count: runs.length,
      };
    },
  },

  get_run_graph: {
    description:
      "Get the full execution graph for a run, including all nodes, edges, and run summary.",
    inputSchema: {
      type: "object",
      required: ["run_id"],
      properties: {
        run_id: { type: "string", description: "The run ID to inspect" },
      },
    },
    handler: async (args: { run_id: string }) => {
      const run = await apiClient.getRun(args.run_id);
      const summary = summarizeRun(run);
      return {
        run_id: run.id,
        query: run.query,
        status: run.status,
        summary,
        nodes: run.nodes.map(n => ({
          id: n.id,
          kind: n.kind,
          label: n.label,
          status: n.status,
          durationMs: n.durationMs,
          tool: n.tool,
          model: n.model,
          hkiDomain: n.hkiDomain,
        })),
        edges: run.edges.map(e => ({
          source: e.source,
          target: e.target,
          kind: e.kind,
        })),
      };
    },
  },

  inspect_node: {
    description:
      "Get full detail on a single node in a run — prompt, output, tokens, latency, and metadata.",
    inputSchema: {
      type: "object",
      required: ["run_id", "node_id"],
      properties: {
        run_id: { type: "string" },
        node_id: { type: "string" },
      },
    },
    handler: async (args: { run_id: string; node_id: string }) => {
      const run = await apiClient.getRun(args.run_id);
      const node = run.nodes.find(n => n.id === args.node_id);
      if (!node)
        throw new Error(`Node ${args.node_id} not found in run ${args.run_id}`);
      const incoming = run.edges.filter(e => e.target === args.node_id);
      const outgoing = run.edges.filter(e => e.source === args.node_id);
      return { node, incoming_edges: incoming, outgoing_edges: outgoing };
    },
  },

  get_critical_path: {
    description:
      "Identify the longest-latency path through a run — shows where time was actually spent.",
    inputSchema: {
      type: "object",
      required: ["run_id"],
      properties: {
        run_id: { type: "string" },
      },
    },
    handler: async (args: { run_id: string }) => {
      const run = await apiClient.getRun(args.run_id);
      const path = computeCriticalPath(run);
      const totalMs = path.reduce((sum, n) => sum + (n.durationMs ?? 0), 0);
      return {
        path: path.map(n => ({
          id: n.id,
          kind: n.kind,
          label: n.label,
          durationMs: n.durationMs ?? 0,
        })),
        total_ms: totalMs,
        bottleneck: path.reduce(
          (max, n) => ((n.durationMs ?? 0) > (max.durationMs ?? 0) ? n : max),
          path[0]
        ),
      };
    },
  },

  compare_runs: {
    description:
      "Structural diff between two runs — what nodes/edges were added, removed, or changed.",
    inputSchema: {
      type: "object",
      required: ["run_id_a", "run_id_b"],
      properties: {
        run_id_a: { type: "string", description: "Baseline run" },
        run_id_b: { type: "string", description: "Comparison run" },
      },
    },
    handler: async (args: { run_id_a: string; run_id_b: string }) => {
      const { diff } = await apiClient.diffRuns(args.run_id_a, args.run_id_b);
      return diff;
    },
  },
};
