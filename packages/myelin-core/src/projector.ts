import type {
  AgentEdge,
  AgentNode,
  AgentRun,
  EdgeKind,
  GraphMutation,
  NodeKind,
  NodeStatus,
  OrchestratorEvent,
  PlanStep,
} from "./types.js";

// ─── Projector state ─────────────────────────────────────────────────────────

export interface ProjectorState {
  lastNodeId: string | null;
  pendingToolCallId: string | null; // maps tool_call node id awaiting its tool_result
  planNodeId: string | null; // current plan node id for step updates
  responseText: string;
  nodeCounter: number;
}

export function createProjectorState(): ProjectorState {
  return {
    lastNodeId: null,
    pendingToolCallId: null,
    planNodeId: null,
    responseText: "",
    nodeCounter: 0,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nodeId(state: ProjectorState, kind: NodeKind): string {
  state.nodeCounter += 1;
  return `${kind}-${state.nodeCounter}`;
}

function edgeId(source: string, target: string): string {
  return `edge-${source}-${target}`;
}

function executionEdge(
  source: string,
  target: string,
  kind: EdgeKind = "execution",
  animated = false
): AgentEdge {
  return { id: edgeId(source, target), source, target, kind, animated };
}

function makeNode(
  id: string,
  kind: NodeKind,
  label: string,
  status: NodeStatus,
  startMs: number,
  extra: Partial<AgentNode> = {}
): AgentNode {
  return { id, kind, label, status, startMs, ...extra };
}

// ─── Core projector ───────────────────────────────────────────────────────────

export function projectEvent(
  run: AgentRun,
  event: OrchestratorEvent,
  state: ProjectorState,
  nowMs: number = Date.now()
): GraphMutation[] {
  const mutations: GraphMutation[] = [];

  function addNode(node: AgentNode): void {
    mutations.push({ op: "add_node", node });
    if (state.lastNodeId && node.kind !== "tool_result") {
      mutations.push({
        op: "add_edge",
        edge: executionEdge(state.lastNodeId, node.id),
      });
    }
    state.lastNodeId = node.id;
  }

  function addToolResultNode(node: AgentNode): void {
    mutations.push({ op: "add_node", node });
    if (state.pendingToolCallId) {
      // data edge: tool_call → tool_result
      mutations.push({
        op: "add_edge",
        edge: executionEdge(state.pendingToolCallId, node.id, "data"),
      });
      state.pendingToolCallId = null;
    } else if (state.lastNodeId) {
      mutations.push({
        op: "add_edge",
        edge: executionEdge(state.lastNodeId, node.id),
      });
    }
    state.lastNodeId = node.id;
  }

  switch (event.type) {
    case "guardrail": {
      const section =
        event.metadata.section === "INPUT_GUARDRAILS" ? "input" : "output";
      const label =
        section === "input" ? "Input Guardrail" : "Output Guardrail";
      const id = nodeId(state, "guardrail");
      addNode(
        makeNode(
          id,
          "guardrail",
          label,
          event.metadata.passed ? "success" : "error",
          nowMs,
          {
            passed: event.metadata.passed,
            score: event.metadata.score,
            violations: event.metadata.violations ?? [],
            guardrailSection: section,
          }
        )
      );
      break;
    }

    case "routing": {
      const id = nodeId(state, "routing");
      addNode(
        makeNode(
          id,
          "routing",
          `Route → ${event.metadata.routed_to}`,
          "success",
          nowMs,
          {
            model: event.metadata.model,
            modelTier: event.metadata.model_tier,
            routingReason: event.metadata.reason,
            enabledTools: event.metadata.enabled_tools,
          }
        )
      );
      break;
    }

    case "memory_recall": {
      const id = nodeId(state, "memory_recall");
      addNode(
        makeNode(id, "memory_recall", "Memory Recall", "success", nowMs, {
          totalMemories: event.metadata.total_memories,
        })
      );
      break;
    }

    case "planning": {
      const id = nodeId(state, "planning");
      addNode(
        makeNode(id, "planning", "Building Execution Plan", "running", nowMs, {
          section: event.metadata.section,
          model: event.metadata.model,
        })
      );
      break;
    }

    case "plan_generated": {
      const id = nodeId(state, "plan");
      state.planNodeId = id;
      const steps: PlanStep[] = event.metadata.steps.map(s => ({
        stepId: s.step_id,
        description: s.description,
        toolName: s.tool_name,
        status: "planned",
      }));
      // Update previous planning node to success if present
      const planningNode = run.nodes.findLast(n => n.kind === "planning");
      if (planningNode) {
        mutations.push({
          op: "update_node",
          id: planningNode.id,
          updates: { status: "success", endMs: nowMs },
        });
      }
      addNode(
        makeNode(
          id,
          "plan",
          `Plan: ${event.metadata.total_steps} steps`,
          "running",
          nowMs,
          {
            planId: event.metadata.plan_id,
            goal: event.metadata.goal,
            steps,
          }
        )
      );
      break;
    }

    case "step_started": {
      if (state.planNodeId) {
        const planNode = run.nodes.find(n => n.id === state.planNodeId);
        if (planNode?.steps) {
          const updated = planNode.steps.map(s =>
            s.stepId === event.metadata.step_id
              ? { ...s, status: "executing" as const }
              : s
          );
          mutations.push({
            op: "update_node",
            id: state.planNodeId,
            updates: { steps: updated },
          });
        }
      }
      break;
    }

    case "step_verified": {
      if (state.planNodeId) {
        const planNode = run.nodes.find(n => n.id === state.planNodeId);
        if (planNode?.steps) {
          const updated = planNode.steps.map(s =>
            s.stepId === event.metadata.step_id
              ? {
                  ...s,
                  status: "completed" as const,
                  durationMs: event.metadata.duration_ms,
                }
              : s
          );
          mutations.push({
            op: "update_node",
            id: state.planNodeId,
            updates: { steps: updated },
          });
        }
      }
      break;
    }

    case "step_failed": {
      if (state.planNodeId) {
        const planNode = run.nodes.find(n => n.id === state.planNodeId);
        if (planNode?.steps) {
          const updated = planNode.steps.map(s =>
            s.stepId === event.metadata.step_id
              ? { ...s, status: "failed" as const, error: event.metadata.error }
              : s
          );
          mutations.push({
            op: "update_node",
            id: state.planNodeId,
            updates: { steps: updated, status: "warning" },
          });
        }
      }
      break;
    }

    case "thinking": {
      const meta = event.metadata;
      // Model fallback is a distinct visual node
      if (meta.section === "MODEL_FALLBACK") {
        const id = nodeId(state, "thinking");
        addNode(
          makeNode(id, "thinking", "Model Fallback", "warning", nowMs, {
            section: meta.section,
            icon: meta.icon,
            reasoning: meta.reasoning,
            failedModel: meta.failed_model,
            fallbackModel: meta.fallback_model,
          })
        );
        break;
      }
      // Skip lightweight UNDERSTANDING/SYNTHESIS thinking nodes — they're noise unless planning is off
      if (meta.section === "UNDERSTANDING" || meta.section === "SYNTHESIS") {
        break;
      }
      const id = nodeId(state, "thinking");
      addNode(
        makeNode(
          id,
          "thinking",
          event.content?.slice(0, 60) ?? meta.section,
          "success",
          nowMs,
          {
            section: meta.section,
            icon: meta.icon,
            reasoning: meta.reasoning,
          }
        )
      );
      break;
    }

    case "tool_call": {
      const id = nodeId(state, "tool_call");
      state.pendingToolCallId = id;
      addNode(
        makeNode(id, "tool_call", event.metadata.tool, "running", nowMs, {
          tool: event.metadata.tool,
          toolArgs: event.metadata.arguments,
          cacheHit: event.metadata.cache_hit ?? false,
        })
      );
      break;
    }

    case "knowledge_retrieval": {
      // Enrich the pending tool_call node with KB metadata rather than add a new node
      const toolCallNode = run.nodes.findLast(n => n.kind === "tool_call");
      if (toolCallNode) {
        mutations.push({
          op: "update_node",
          id: toolCallNode.id,
          updates: {
            citations: event.metadata.citations,
            resultCount: event.metadata.result_count,
          },
        });
      }
      break;
    }

    case "tool_result": {
      const result = event.metadata.result;
      const hasError = Boolean(result.error);
      const id = nodeId(state, "tool_result");

      // Complete the tool_call node
      const toolCallNode = run.nodes.findLast(
        n => n.kind === "tool_call" && n.status === "running"
      );
      if (toolCallNode) {
        mutations.push({
          op: "update_node",
          id: toolCallNode.id,
          updates: {
            status: hasError ? "error" : "success",
            endMs: nowMs,
            durationMs: result.duration_ms,
            cacheHit: result.cache_hit,
            error: result.error,
          },
        });
        state.pendingToolCallId = toolCallNode.id;
      }

      addToolResultNode(
        makeNode(
          id,
          "tool_result",
          `${result.name} result`,
          hasError ? "error" : "success",
          nowMs,
          {
            tool: result.name,
            toolOutput: result.output,
            durationMs: result.duration_ms,
            cacheHit: result.cache_hit,
            error: result.error,
            endMs: nowMs,
          }
        )
      );
      break;
    }

    case "reflecting": {
      const usage = event.metadata.token_usage;
      const id = nodeId(state, "reflecting");
      addNode(
        makeNode(id, "reflecting", "Token Reflection", "success", nowMs, {
          tokens: {
            prompt: usage.prompt_tokens,
            completion: usage.completion_tokens,
            total: usage.total_tokens,
            llmCalls: usage.llm_calls,
            kbChunksRetrieved: usage.kb_chunks_retrieved,
            estimatedTokensSaved: usage.estimated_tokens_saved,
          },
        })
      );
      break;
    }

    case "human_escalation": {
      const iv = event.metadata.intervention;
      const id = nodeId(state, "escalation");
      addNode(
        makeNode(
          id,
          "escalation",
          "Human Approval Required",
          "warning",
          nowMs,
          {
            escalationContext: iv.context,
            availableActions: iv.available_actions,
            error: iv.error,
          }
        )
      );
      break;
    }

    case "final_response_chunk": {
      state.responseText += event.content ?? "";
      break;
    }

    case "final_response": {
      const text = event.content ?? state.responseText;
      const id = nodeId(state, "response");
      addNode(
        makeNode(id, "response", "Response", "success", nowMs, {
          responseText: text.slice(0, 500),
          endMs: nowMs,
        })
      );
      mutations.push({
        op: "update_run",
        updates: { endMs: nowMs, status: "success" },
      });
      break;
    }

    case "response_metadata": {
      mutations.push({
        op: "update_run",
        updates: {
          model: event.metadata.model,
          confidence: event.metadata.confidence,
          hkiDomain: event.metadata.scope as string | undefined,
        },
      });
      // Back-fill response node confidence
      const responseNode = run.nodes.findLast(n => n.kind === "response");
      if (responseNode && event.metadata.confidence != null) {
        mutations.push({
          op: "update_node",
          id: responseNode.id,
          updates: { confidence: event.metadata.confidence as number },
        });
      }
      break;
    }

    case "prompt_stack":
      // Internal — skip
      break;

    default:
      break;
  }

  return mutations;
}

// ─── Apply mutations to a run ─────────────────────────────────────────────────

export function applyMutations(
  run: AgentRun,
  mutations: GraphMutation[]
): AgentRun {
  let result = { ...run, nodes: [...run.nodes], edges: [...run.edges] };

  for (const mutation of mutations) {
    switch (mutation.op) {
      case "add_node":
        result.nodes = [...result.nodes, mutation.node];
        break;

      case "update_node": {
        result.nodes = result.nodes.map(n =>
          n.id === mutation.id ? { ...n, ...mutation.updates } : n
        );
        break;
      }

      case "add_edge":
        result.edges = [...result.edges, mutation.edge];
        break;

      case "update_run":
        result = { ...result, ...mutation.updates };
        break;
    }
  }

  return result;
}

// ─── Full replay ──────────────────────────────────────────────────────────────

export function replayEvents(
  runId: string,
  query: string,
  events: OrchestratorEvent[],
  startMs = Date.now()
): AgentRun {
  let run: AgentRun = {
    id: runId,
    query,
    startMs,
    status: "running",
    nodes: [],
    edges: [],
  };
  const state = createProjectorState();

  for (const event of events) {
    const mutations = projectEvent(run, event, state);
    run = applyMutations(run, mutations);
  }

  return run;
}
