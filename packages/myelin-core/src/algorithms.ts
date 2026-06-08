import type {
  AgentEdge,
  AgentNode,
  AgentRun,
  NodeDiff,
  RunDiff,
  RunSummary,
} from "./types.js";

// ─── Critical path ────────────────────────────────────────────────────────────

function buildAdjacency(edges: AgentEdge[]): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const edge of edges) {
    if (!adj.has(edge.source)) adj.set(edge.source, []);
    adj.get(edge.source)!.push(edge.target);
  }
  return adj;
}

function topologicalSort(nodeIds: string[], edges: AgentEdge[]): string[] {
  const adj = buildAdjacency(edges);
  const inDegree = new Map<string, number>();
  for (const id of nodeIds) inDegree.set(id, 0);
  for (const edge of edges) {
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const u = queue.shift()!;
    order.push(u);
    for (const v of adj.get(u) ?? []) {
      const deg = (inDegree.get(v) ?? 1) - 1;
      inDegree.set(v, deg);
      if (deg === 0) queue.push(v);
    }
  }
  return order;
}

export function computeCriticalPath(run: AgentRun): AgentNode[] {
  if (run.nodes.length === 0) return [];

  const nodeMap = new Map(run.nodes.map(n => [n.id, n]));
  const order = topologicalSort(
    run.nodes.map(n => n.id),
    run.edges
  );
  const adj = buildAdjacency(run.edges);

  // Longest-latency path using topological DP
  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();

  for (const id of order) {
    dist.set(id, nodeMap.get(id)?.durationMs ?? 0);
    prev.set(id, null);
  }

  for (const u of order) {
    const uDist = dist.get(u) ?? 0;
    for (const v of adj.get(u) ?? []) {
      const vWeight = nodeMap.get(v)?.durationMs ?? 0;
      const candidate = uDist + vWeight;
      if (candidate > (dist.get(v) ?? 0)) {
        dist.set(v, candidate);
        prev.set(v, u);
      }
    }
  }

  // Find the sink node with the highest distance
  const sinks = run.nodes.filter(n => (adj.get(n.id) ?? []).length === 0);
  if (sinks.length === 0) return [];

  const firstSink = sinks[0]!;
  const endId = sinks.reduce(
    (best, n) => ((dist.get(n.id) ?? 0) > (dist.get(best.id) ?? 0) ? n : best),
    firstSink
  ).id;

  // Reconstruct path by walking prev pointers
  const path: string[] = [];
  let current: string | null = endId;
  while (current !== null) {
    path.unshift(current);
    current = prev.get(current) ?? null;
  }

  return path.map(id => nodeMap.get(id)!).filter(Boolean);
}

// ─── Blast radius ─────────────────────────────────────────────────────────────

export function computeBlastRadius(
  run: AgentRun,
  startNodeId: string
): Set<string> {
  const adj = buildAdjacency(run.edges);
  const seen = new Set<string>([startNodeId]);
  const stack = [startNodeId];

  while (stack.length > 0) {
    const u = stack.pop()!;
    for (const v of adj.get(u) ?? []) {
      if (!seen.has(v)) {
        seen.add(v);
        stack.push(v);
      }
    }
  }

  return seen;
}

// ─── Run summary ──────────────────────────────────────────────────────────────

export function summarizeRun(run: AgentRun): RunSummary {
  const toolCalls = run.nodes.filter(n => n.kind === "tool_call");
  const reflectingNode = run.nodes.find(n => n.kind === "reflecting");
  const responseNode = run.nodes.find(n => n.kind === "response");

  return {
    totalMs: run.endMs != null ? run.endMs - run.startMs : 0,
    toolCallCount: toolCalls.length,
    llmCalls:
      reflectingNode?.tokens?.llmCalls ??
      (run.nodes.some(n => n.kind === "routing") ? 1 : 0),
    kbHits:
      reflectingNode?.tokens?.kbChunksRetrieved ??
      toolCalls.filter(n => n.citations != null).length,
    tokensUsed: reflectingNode?.tokens?.total ?? 0,
    confidence: responseNode?.confidence ?? run.confidence ?? null,
    hkiDomain: run.hkiDomain ?? null,
    model: run.model ?? null,
    status: run.status,
  };
}

// ─── Run diff ─────────────────────────────────────────────────────────────────

export function diffRuns(runA: AgentRun, runB: AgentRun): RunDiff {
  const aNodes = new Map(runA.nodes.map(n => [n.id, n]));
  const bNodes = new Map(runB.nodes.map(n => [n.id, n]));
  const aEdges = new Map(runA.edges.map(e => [e.id, e]));
  const bEdges = new Map(runB.edges.map(e => [e.id, e]));

  const addedNodes = runB.nodes.filter(n => !aNodes.has(n.id));
  const removedNodes = runA.nodes.filter(n => !bNodes.has(n.id));
  const changedNodes: NodeDiff["changed"] = [];

  for (const [id, bNode] of bNodes) {
    const aNode = aNodes.get(id);
    if (!aNode) continue;
    const changedFields = (Object.keys(bNode) as Array<keyof AgentNode>).filter(
      k => JSON.stringify(aNode[k]) !== JSON.stringify(bNode[k])
    );
    if (changedFields.length > 0) {
      changedNodes.push({ nodeId: id, fields: changedFields as string[] });
    }
  }

  return {
    nodes: { added: addedNodes, removed: removedNodes, changed: changedNodes },
    edges: {
      added: runB.edges.filter(e => !aEdges.has(e.id)),
      removed: runA.edges.filter(e => !bEdges.has(e.id)),
    },
  };
}
