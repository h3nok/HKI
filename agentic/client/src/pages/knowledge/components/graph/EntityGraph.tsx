/**
 * EntityGraph — Professional Knowledge Graph Explorer
 *
 * Built on @xyflow/react (React Flow v12) + d3-force.
 *
 * Architecture:
 *   - @xyflow/react handles: rendering, pan/zoom, node drag, minimap, controls
 *   - d3-force handles: Barnes-Hut physics layout (handles 500+ nodes)
 *   - Custom EntityNode: Tailwind card nodes with type icons and degree badges
 *   - Smoothstep directed edges with animated expansion and relationship labels
 *   - Neighborhood dimming on node focus
 *   - Demo presets with stream-aware content when no live graph exists
 *
 * For Neo4j production upgrade: swap entitySearch / entityContext tRPC
 * endpoints to use Neo4j Bloom's API or direct GDS queries.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Panel,
  Position,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type OnNodeDrag,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import {
  Brain,
  Building2,
  Calendar,
  ChevronRight,
  FileText,
  Loader2,
  MapPin,
  Network,
  Package,
  RotateCcw,
  ScanLine,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Tags,
  User,
  Workflow,
  X,
} from "lucide-react";
import { cn, useNotifications } from "@hki/ui";
import { trpc } from "@/lib/trpc";
import { cardCls } from "../../types";
import { k, ACCENT } from "../../theme";

// ── Types ─────────────────────────────────────────────────────────────────────

interface EntityNodeData extends Record<string, unknown> {
  label: string;
  entityType: string;
  degree: number;
  mentionCount: number;
  isExpanding: boolean;
  isExpanded: boolean;
  isDimmed: boolean;
}

type EntityFlowNode = Node<EntityNodeData, "entity">;

interface KGEdgeData extends Record<string, unknown> {
  relationshipType: string;
}

type KGFlowEdge = Edge<KGEdgeData>;

interface SimNode extends SimulationNodeDatum {
  id: string;
}

// ── Entity type configuration ─────────────────────────────────────────────────

const TYPE_CONFIG = {
  person: { color: "#3b82f6", Icon: User, label: "Person" },
  organization: { color: "#8b5cf6", Icon: Building2, label: "Organization" },
  location: { color: "#f59e0b", Icon: MapPin, label: "Location" },
  product: { color: ACCENT, Icon: Package, label: "Product" },
  policy: { color: "#ef4444", Icon: Shield, label: "Policy" },
  process: { color: "#06b6d4", Icon: Workflow, label: "Process" },
  concept: { color: "#ec4899", Icon: Brain, label: "Concept" },
  event: { color: "#22c55e", Icon: Calendar, label: "Event" },
  document: { color: "#6b7280", Icon: FileText, label: "Document" },
} as const;

type EntityType = keyof typeof TYPE_CONFIG;

function getTypeCfg(type: string) {
  return (
    TYPE_CONFIG[type?.toLowerCase() as EntityType] ?? {
      color: "#6b7280",
      Icon: FileText,
      label: type ?? "Unknown",
    }
  );
}

// ── Custom EntityNode ─────────────────────────────────────────────────────────

function EntityNode({ data, selected }: NodeProps<EntityFlowNode>) {
  const { color, Icon, label } = getTypeCfg(data.entityType);

  return (
    <div
      className={cn(
        "relative rounded-xl bg-card text-card-foreground",
        "border transition-all duration-200 select-none cursor-pointer",
        "min-w-37 max-w-52",
        data.isDimmed && "opacity-25"
      )}
      style={{
        borderLeft: `3px solid ${color}`,
        borderTop: "1px solid hsl(var(--border))",
        borderRight: "1px solid hsl(var(--border))",
        borderBottom: "1px solid hsl(var(--border))",
        boxShadow: selected
          ? `0 0 0 2px ${color}, 0 0 24px ${color}44, 0 4px 16px rgba(0,0,0,0.12)`
          : "0 2px 8px rgba(0,0,0,0.10), 0 1px 2px rgba(0,0,0,0.06)",
      }}
    >
      {/* Invisible omnidirectional handles */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ opacity: 0, pointerEvents: "none" }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, pointerEvents: "none" }}
      />
      <Handle
        type="target"
        position={Position.Left}
        style={{ opacity: 0, pointerEvents: "none" }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ opacity: 0, pointerEvents: "none" }}
      />

      <div className="px-3 py-2.5 space-y-1.5">
        {/* Row 1: icon + label + loading spinner */}
        <div className="flex items-start gap-2">
          <div
            className="mt-0.5 h-5 w-5 rounded-md flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${color}1e` }}
          >
            <Icon className="w-3 h-3" style={{ color }} />
          </div>
          <span className="text-xs font-semibold text-foreground leading-tight line-clamp-2 flex-1">
            {data.label}
          </span>
          {data.isExpanding && (
            <Loader2 className="w-3 h-3 animate-spin text-muted-foreground/50 shrink-0 mt-0.5" />
          )}
        </div>

        {/* Row 2: type badge + degree count */}
        <div className="flex items-center justify-between gap-1">
          <span
            className="px-1.5 py-0.5 text-[10px] font-semibold rounded-md leading-none"
            style={{ backgroundColor: `${color}1a`, color }}
          >
            {label}
          </span>
          {data.degree > 0 && (
            <span className="text-[10px] text-muted-foreground/50 tabular-nums">
              {data.degree}
            </span>
          )}
          {data.isExpanded && (
            <span className="text-[10px] text-primary/60">✓</span>
          )}
        </div>
      </div>
    </div>
  );
}

const NODE_TYPES = { entity: EntityNode };

// ── Demo presets ──────────────────────────────────────────────────────────────

interface DemoPreset {
  subtitle: string;
  suggestedQueries: string[];
  nodes: Array<{ id: string; label: string; type: string }>;
  edges: Array<{ source: string; target: string; label: string }>;
}

function getDemoPreset(stream?: string, streamLabel?: string): DemoPreset {
  const s = (stream ?? "").toLowerCase();
  const name = streamLabel ?? "this stream";

  if (s.includes("pharma")) {
    return {
      subtitle: `Healthy pharmacy graph for ${name} after policies, FAQs, and SOPs are indexed.`,
      suggestedQueries: [
        "controlled substance return",
        "prior authorization",
        "vaccine storage",
      ],
      nodes: [
        { id: "pharmacist", label: "Pharmacist on Duty", type: "person" },
        { id: "cold-chain", label: "Cold Chain Log", type: "process" },
        { id: "vaccine", label: "Vaccine Storage Policy", type: "policy" },
        { id: "dea-form", label: "DEA Form 222", type: "document" },
        { id: "transfer", label: "Prescription Transfer", type: "process" },
      ],
      edges: [
        { source: "pharmacist", target: "cold-chain", label: "maintains" },
        { source: "cold-chain", target: "vaccine", label: "supports" },
        { source: "pharmacist", target: "transfer", label: "approves" },
        { source: "transfer", target: "dea-form", label: "references" },
      ],
    };
  }

  if (s.includes("logistics") || s.includes("delivery") || s.includes("pkg")) {
    return {
      subtitle: `Logistics knowledge map for ${name} — warehouse, carrier, and exception content.`,
      suggestedQueries: [
        "damaged pallet",
        "carrier claim",
        "delivery exception",
      ],
      nodes: [
        { id: "dock", label: "Loading Dock", type: "location" },
        { id: "claim", label: "Carrier Claim", type: "policy" },
        { id: "receiver", label: "Store Receiver", type: "person" },
        { id: "seal", label: "Trailer Seal Log", type: "process" },
        { id: "damage", label: "Damage Exception", type: "concept" },
      ],
      edges: [
        { source: "receiver", target: "dock", label: "works at" },
        { source: "dock", target: "seal", label: "checks" },
        { source: "seal", target: "damage", label: "flags" },
        { source: "damage", target: "claim", label: "triggers" },
      ],
    };
  }

  return {
    subtitle:
      "Graphs become useful when policies, SOPs, and questions all reference the same concepts.",
    suggestedQueries: [
      "return policy",
      "manager escalation",
      "inventory count",
    ],
    nodes: [
      { id: "returns", label: "Return Policy", type: "policy" },
      { id: "manager", label: "Store Manager", type: "person" },
      { id: "desk", label: "Member Services", type: "location" },
      { id: "exception", label: "Escalation Path", type: "process" },
      { id: "receipt", label: "Receipt Lookup", type: "concept" },
    ],
    edges: [
      { source: "returns", target: "desk", label: "used at" },
      { source: "desk", target: "manager", label: "escalates" },
      { source: "manager", target: "exception", label: "follows" },
      { source: "returns", target: "receipt", label: "depends on" },
    ],
  };
}

// ── Graph-data helpers ────────────────────────────────────────────────────────

type RawEntity = {
  name?: string;
  id?: string;
  label?: string;
  entityType?: string;
  type?: string;
  connected_chunks?: string[];
  mention_count?: number;
};

type RawEdge = { source: string; target: string; label: string };

function buildCoOccurrenceEdges(entities: RawEntity[]): RawEdge[] {
  const result: RawEdge[] = [];
  for (let i = 0; i < entities.length; i++) {
    const a = new Set<string>(entities[i].connected_chunks ?? []);
    if (a.size === 0) continue;
    for (let j = i + 1; j < entities.length; j++) {
      if ((entities[j].connected_chunks ?? []).some(c => a.has(c))) {
        result.push({
          source: entities[i].name ?? entities[i].id ?? `e${i}`,
          target: entities[j].name ?? entities[j].id ?? `e${j}`,
          label: "co-occurs",
        });
      }
    }
  }
  return result;
}

function buildFlowNodes(
  entities: RawEntity[],
  rawEdges: RawEdge[]
): EntityFlowNode[] {
  const degreeMap = new Map<string, number>();
  for (const e of rawEdges) {
    degreeMap.set(e.source, (degreeMap.get(e.source) ?? 0) + 1);
    degreeMap.set(e.target, (degreeMap.get(e.target) ?? 0) + 1);
  }
  return entities.map((entity, i) => {
    const id = entity.name ?? entity.id ?? `entity-${i}`;
    const angle = (2 * Math.PI * i) / Math.max(entities.length, 1);
    return {
      id,
      type: "entity" as const,
      position: { x: 160 * Math.cos(angle), y: 160 * Math.sin(angle) },
      data: {
        label: entity.label ?? entity.name ?? "Unknown",
        entityType: entity.entityType ?? entity.type ?? "concept",
        degree: degreeMap.get(id) ?? 0,
        mentionCount: entity.mention_count ?? 0,
        isExpanding: false,
        isExpanded: false,
        isDimmed: false,
      },
      draggable: true,
      selectable: true,
    };
  });
}

function buildFlowEdges(
  rawEdges: RawEdge[],
  nodeSet: Set<string>
): KGFlowEdge[] {
  return rawEdges
    .filter(e => nodeSet.has(e.source) && nodeSet.has(e.target))
    .map((e, i) => ({
      id: `e-${e.source}-${e.target}-${i}`,
      source: e.source,
      target: e.target,
      label: e.label,
      type: "smoothstep",
      animated: false,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 12,
        height: 12,
        color: "#94a3b8",
      },
      data: { relationshipType: e.label },
      style: { stroke: "#94a3b8", strokeWidth: 1.2, opacity: 0.6 },
      labelStyle: { fontSize: "10px", fill: "#94a3b8", fontWeight: "500" },
      labelBgStyle: { fill: "hsl(var(--card))", fillOpacity: 0.88 },
      labelBgPadding: [3, 5] as [number, number],
      labelBgBorderRadius: 3,
    }));
}

// ── Core component (must be inside ReactFlowProvider) ─────────────────────────

interface CoreProps {
  selectedStream?: string;
  streamLabel?: string;
  onOpenTaxonomy?: () => void;
}

function EntityGraphCore({
  selectedStream,
  streamLabel,
  onOpenTaxonomy,
}: CoreProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<EntityFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<KGFlowEdge>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [isDemoGraph, setIsDemoGraph] = useState(false);

  const { fitView } = useReactFlow();
  const { notify } = useNotifications();

  // d3-force state lives outside React state to avoid triggering re-renders
  const simRef = useRef<ReturnType<typeof forceSimulation<SimNode>> | null>(
    null
  );
  const simMap = useRef<Map<string, SimNode>>(new Map());
  // Signal to run layout after next state flush
  const layoutFlag = useRef<{ reheat: boolean } | null>(null);

  // ── tRPC ───────────────────────────────────────────────────────────────────

  const graphStatsQ = trpc.knowledge.graphStats.useQuery(
    selectedStream ? { valueStreamId: selectedStream } : undefined,
    { retry: false, staleTime: 30_000 }
  );
  const rootsQ = trpc.knowledge.taxonomyListRoots.useQuery(undefined, {
    retry: false,
    staleTime: 30_000,
  });

  const liveCount =
    graphStatsQ.data?.totalEntities ?? graphStatsQ.data?.entityCount ?? 0;
  const hasTaxonomy = (rootsQ.data?.length ?? 0) > 0;

  const searchMut = trpc.knowledge.entitySearch.useMutation({
    onSuccess: data => {
      const entities: RawEntity[] = data.entities ?? [];
      if (!entities.length) {
        notify({
          title: "No entities found",
          description: "Try a different term.",
          severity: "info",
        });
        return;
      }
      commitGraph(entities, [], false);
    },
    onError: err =>
      notify({
        title: "Entity search failed",
        description: err.message,
        severity: "error",
      }),
  });

  const contextMut = trpc.knowledge.entityContext.useMutation({
    onSuccess: (data, vars) => {
      if (!data.neighbors?.length) {
        notify({
          title: "No neighbors found for this entity",
          severity: "info",
        });
        clearExpanding(vars.entityName);
        return;
      }
      appendNeighbors(
        vars.entityName,
        data.neighbors ?? [],
        data.relationships ?? []
      );
    },
    onError: (err, vars) => {
      notify({
        title: "Context lookup failed",
        description: err.message,
        severity: "error",
      });
      clearExpanding(vars.entityName);
    },
  });

  // ── d3-force simulation ────────────────────────────────────────────────────

  const runSimulation = useCallback(
    (rfNodes: EntityFlowNode[], rfEdges: KGFlowEdge[], reheat: boolean) => {
      simRef.current?.stop();
      if (rfNodes.length === 0) return;

      // Build d3 nodes, preserving positions from previous run
      const simNodes: SimNode[] = rfNodes.map(n => {
        const prev = simMap.current.get(n.id);
        return {
          id: n.id,
          x: prev?.x ?? n.position.x,
          y: prev?.y ?? n.position.y,
          fx: prev?.fx ?? undefined,
          fy: prev?.fy ?? undefined,
        };
      });

      const nodeSet = new Set(rfNodes.map(n => n.id));
      const simLinks: SimulationLinkDatum<SimNode>[] = rfEdges
        .filter(
          e =>
            nodeSet.has(e.source as string) && nodeSet.has(e.target as string)
        )
        .map(e => ({ source: e.source as string, target: e.target as string }));

      const sim = forceSimulation<SimNode>(simNodes)
        .force(
          "link",
          forceLink<SimNode, SimulationLinkDatum<SimNode>>(simLinks)
            .id(d => d.id)
            .distance(180)
            .strength(0.35)
        )
        .force(
          "charge",
          forceManyBody<SimNode>().strength(-700).distanceMax(600)
        )
        .force("center", forceCenter(0, 0).strength(0.04))
        .force("collision", forceCollide<SimNode>().radius(88).strength(0.8))
        .alphaDecay(0.025)
        .velocityDecay(0.38);

      if (!reheat) {
        // Warm start: run synchronously to near-convergence before first paint
        sim.tick(160);
      } else {
        sim.alpha(0.55);
      }

      // Commit initial positions immediately
      simMap.current = new Map(simNodes.map(n => [n.id, n]));
      flushPositions(simNodes);

      // Continue animating remaining alpha
      sim.on("tick", () => {
        simMap.current = new Map(simNodes.map(n => [n.id, n]));
        flushPositions(simNodes);
      });

      simRef.current = sim;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  function flushPositions(simNodes: SimNode[]) {
    setNodes(prev =>
      prev.map(node => {
        const sn = simNodes.find(s => s.id === node.id);
        return sn
          ? { ...node, position: { x: sn.x ?? 0, y: sn.y ?? 0 } }
          : node;
      })
    );
  }

  // Run simulation whenever nodes/edges are added (flagged via layoutFlag)
  useEffect(() => {
    if (!layoutFlag.current || nodes.length === 0) return;
    const { reheat } = layoutFlag.current;
    layoutFlag.current = null;
    runSimulation(nodes, edges, reheat);
    if (!reheat) {
      const t = setTimeout(
        () => fitView({ padding: 0.22, duration: 500 }),
        320
      );
      return () => clearTimeout(t);
    }
    // Only re-run when counts change (position updates don't change counts)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length, edges.length]);

  // ── Graph mutation helpers ─────────────────────────────────────────────────

  const commitGraph = useCallback(
    (entities: RawEntity[], rawEdges: RawEdge[], demo: boolean) => {
      const coEdges =
        rawEdges.length > 0 ? rawEdges : buildCoOccurrenceEdges(entities);
      const rfNodes = buildFlowNodes(entities, coEdges);
      const nodeSet = new Set(rfNodes.map(n => n.id));
      const rfEdges = buildFlowEdges(coEdges, nodeSet);

      setNodes(rfNodes);
      setEdges(rfEdges);
      setSelectedId(null);
      setIsDemoGraph(demo);
      layoutFlag.current = { reheat: false };
    },
    [setNodes, setEdges]
  );

  const appendNeighbors = useCallback(
    (
      entityName: string,
      neighbors: Array<{
        name: string;
        entityType: string;
        relationship: string;
      }>,
      relationships: Array<{ source: string; target: string; type: string }>
    ) => {
      setNodes(prev => {
        const existingIds = new Set(prev.map(n => n.id));
        const newNodes: EntityFlowNode[] = neighbors
          .filter(nb => !existingIds.has(nb.name))
          .map((nb, i) => {
            const angle = (2 * Math.PI * i) / Math.max(neighbors.length, 1);
            return {
              id: nb.name,
              type: "entity" as const,
              position: { x: 200 * Math.cos(angle), y: 200 * Math.sin(angle) },
              data: {
                label: nb.name,
                entityType: nb.entityType,
                degree: 1,
                mentionCount: 0,
                isExpanding: false,
                isExpanded: false,
                isDimmed: false,
              },
              draggable: true,
              selectable: true,
            };
          });

        return [
          ...prev.map(n =>
            n.id === entityName
              ? {
                  ...n,
                  data: { ...n.data, isExpanding: false, isExpanded: true },
                }
              : n
          ),
          ...newNodes,
        ];
      });

      setEdges(prev => {
        const existing = new Set(prev.map(e => `${e.source}→${e.target}`));
        const newEdges: KGFlowEdge[] = relationships
          .filter(r => !existing.has(`${r.source}→${r.target}`))
          .map(r => ({
            id: `e-${r.source}-${r.target}-${Date.now()}`,
            source: r.source,
            target: r.target,
            label: r.type.replace(/_/g, " "),
            type: "smoothstep",
            animated: true,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 12,
              height: 12,
              color: "#94a3b8",
            },
            data: { relationshipType: r.type },
            style: { stroke: "#60a5fa", strokeWidth: 1.4, opacity: 0.75 },
            labelStyle: {
              fontSize: "10px",
              fill: "#94a3b8",
              fontWeight: "500",
            },
            labelBgStyle: { fill: "hsl(var(--card))", fillOpacity: 0.88 },
            labelBgPadding: [3, 5] as [number, number],
            labelBgBorderRadius: 3,
          }));

        // De-animate new edges after 2 s
        setTimeout(() => {
          setEdges(es =>
            es.map(e => ({
              ...e,
              animated: false,
              style: { stroke: "#94a3b8", strokeWidth: 1.2, opacity: 0.6 },
            }))
          );
        }, 2000);

        return [...prev, ...newEdges];
      });

      layoutFlag.current = { reheat: true };
    },
    [setNodes, setEdges]
  );

  const clearExpanding = useCallback(
    (entityName: string) =>
      setNodes(prev =>
        prev.map(n =>
          n.id === entityName
            ? { ...n, data: { ...n.data, isExpanding: false } }
            : n
        )
      ),
    [setNodes]
  );

  // ── Interaction handlers ───────────────────────────────────────────────────

  const runSearch = useCallback(
    (text: string) => {
      const q = text.trim();
      if (!q) return;
      setQuery(q);
      searchMut.mutate({
        query: q,
        ...(selectedStream ? { valueStreamId: selectedStream } : {}),
      });
    },
    [searchMut, selectedStream]
  );

  const loadDemo = useCallback(() => {
    const preset = getDemoPreset(selectedStream, streamLabel);
    const entities = preset.nodes.map(n => ({
      name: n.id,
      label: n.label,
      entityType: n.type,
    }));
    commitGraph(entities, preset.edges, true);
    setQuery(preset.suggestedQueries[0] ?? "");
  }, [selectedStream, streamLabel, commitGraph]);

  const resetGraph = useCallback(() => {
    simRef.current?.stop();
    setNodes([]);
    setEdges([]);
    setSelectedId(null);
    setIsDemoGraph(false);
    setQuery("");
  }, [setNodes, setEdges]);

  const handleNodeClick: OnNodeDrag<EntityFlowNode> = useCallback(
    (_evt, node) => {
      const next = selectedId === node.id ? null : node.id;
      setSelectedId(next);

      // Dim unconnected nodes
      const connectedIds = next
        ? new Set([
            next,
            ...edges
              .filter(e => e.source === next || e.target === next)
              .flatMap(e => [e.source as string, e.target as string]),
          ])
        : null;

      setNodes(prev =>
        prev.map(n => ({
          ...n,
          data: {
            ...n.data,
            isDimmed: !!connectedIds && !connectedIds.has(n.id),
          },
        }))
      );

      // Expand neighborhood (live graph only)
      if (
        next &&
        !isDemoGraph &&
        !node.data.isExpanded &&
        !node.data.isExpanding
      ) {
        setNodes(prev =>
          prev.map(n =>
            n.id === node.id
              ? { ...n, data: { ...n.data, isExpanding: true } }
              : n
          )
        );
        contextMut.mutate({
          entityName: node.id,
          entityType: node.data.entityType,
          ...(selectedStream ? { valueStreamId: selectedStream } : {}),
        });
      }
    },
    [selectedId, isDemoGraph, edges, setNodes, contextMut, selectedStream]
  );

  const handlePaneClick = useCallback(() => {
    setSelectedId(null);
    setNodes(prev =>
      prev.map(n => ({ ...n, data: { ...n.data, isDimmed: false } }))
    );
  }, [setNodes]);

  const handleNodeDrag: OnNodeDrag<EntityFlowNode> = useCallback(
    (_evt, node) => {
      const sn = simMap.current.get(node.id);
      if (sn) {
        sn.fx = node.position.x;
        sn.fy = node.position.y;
      }
    },
    []
  );

  const handleNodeDragStop: OnNodeDrag<EntityFlowNode> = useCallback(
    (_evt, node) => {
      // Release fixed position after short delay so the node settles
      const t = setTimeout(() => {
        const sn = simMap.current.get(node.id);
        if (sn) {
          sn.fx = undefined;
          sn.fy = undefined;
        }
        simRef.current?.alpha(0.08).restart();
      }, 600);
      return () => clearTimeout(t);
    },
    []
  );

  // ── Derived ────────────────────────────────────────────────────────────────

  const selectedNode = useMemo(
    () => nodes.find(n => n.id === selectedId) ?? null,
    [nodes, selectedId]
  );
  const scopeLabel = selectedStream
    ? (streamLabel ?? selectedStream)
    : "All streams";
  const hasNodes = nodes.length > 0;
  const demoPreset = useMemo(
    () => getDemoPreset(selectedStream, streamLabel),
    [selectedStream, streamLabel]
  );
  const edgeCount = edges.length;
  const selectedConnections = selectedId
    ? edges.filter(e => e.source === selectedId || e.target === selectedId)
        .length
    : 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* ── Search bar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-60">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && runSearch(query)}
            placeholder="Search entities — e.g. 'return policy', 'carrier claim'…"
            className={cn(k.input, "pl-9")}
          />
        </div>
        <button
          onClick={() => runSearch(query)}
          disabled={!query.trim() || searchMut.isPending}
          className={k.btnPrimary}
        >
          {searchMut.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Network className="w-3.5 h-3.5" />
          )}
          Explore
        </button>
        {hasNodes && (
          <button onClick={resetGraph} className={k.btnGhost}>
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        )}
      </div>

      {/* ── Status pills ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border/30 bg-card/80 px-3 py-1 text-[11px] font-medium text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          {scopeLabel}
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border/30 bg-card/80 px-3 py-1 text-[11px] font-medium text-muted-foreground">
          <Network className="h-3.5 w-3.5 text-primary" />
          {liveCount > 0
            ? `${liveCount.toLocaleString()} live entities`
            : "No live graph for this scope"}
        </div>
        {isDemoGraph && (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/8 px-3 py-1 text-[11px] font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Demo preview
          </div>
        )}
        {hasNodes && (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border/30 bg-card/80 px-3 py-1 text-[11px] text-muted-foreground tabular-nums">
            {nodes.length} nodes · {edgeCount} edges
          </div>
        )}
      </div>

      {/* ── Main canvas card ── */}
      <div className={cn(cardCls, "overflow-hidden")}>
        <div className="border-b border-border/30 px-5 py-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Network className="w-4 h-4 text-primary" />
              Knowledge Graph
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {isDemoGraph
                ? demoPreset.subtitle
                : hasNodes
                  ? "Click a node to expand its neighborhood. Drag to rearrange."
                  : "Search an entity above or preview a sample graph."}
            </p>
          </div>
          {hasNodes && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => fitView({ padding: 0.2, duration: 400 })}
                className={cn(k.btnGhost, "text-xs")}
              >
                <ScanLine className="w-3.5 h-3.5" /> Fit
              </button>
              {isDemoGraph && (
                <button
                  onClick={resetGraph}
                  className={cn(k.btnGhost, "text-xs")}
                >
                  Live graph
                </button>
              )}
            </div>
          )}
        </div>

        {hasNodes ? (
          <div className="h-145">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={handleNodeClick as any}
              onPaneClick={handlePaneClick}
              onNodeDrag={handleNodeDrag}
              onNodeDragStop={handleNodeDragStop}
              nodeTypes={NODE_TYPES}
              nodesConnectable={false}
              selectNodesOnDrag={false}
              elevateEdgesOnSelect
              fitView
              fitViewOptions={{ padding: 0.22 }}
              proOptions={{ hideAttribution: true }}
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={22}
                size={1}
                color="hsl(var(--muted-foreground) / 0.18)"
              />
              <Controls
                showInteractive={false}
                className={cn(
                  "border-border/30! bg-card! rounded-xl! shadow-sm!",
                  "[&>button]:border-border/30! [&>button]:bg-card! [&>button]:text-foreground!",
                  "[&>button:hover]:bg-muted! [&>button:first-child]:rounded-t-xl!",
                  "[&>button:last-child]:rounded-b-xl!"
                )}
              />
              <MiniMap
                nodeColor={n =>
                  getTypeCfg((n.data as EntityNodeData).entityType).color
                }
                maskColor="hsl(var(--background) / 0.75)"
                className="border-border/30! bg-card! rounded-xl! shadow-sm! overflow-hidden"
              />

              {/* Type legend */}
              <Panel position="bottom-left">
                <div
                  className={cn(
                    "flex flex-wrap gap-x-3 gap-y-1.5 max-w-75 px-3 py-2 rounded-xl",
                    "border border-border/30 bg-card/90 backdrop-blur-sm text-[10px]"
                  )}
                >
                  {Object.entries(TYPE_CONFIG).map(([type, cfg]) => (
                    <div key={type} className="flex items-center gap-1.5">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: cfg.color }}
                      />
                      <span className="text-muted-foreground/70 capitalize">
                        {cfg.label}
                      </span>
                    </div>
                  ))}
                </div>
              </Panel>

              {/* Demo mode banner */}
              {isDemoGraph && (
                <Panel position="top-center">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-card/90 backdrop-blur-sm text-[11px] font-semibold text-primary shadow-sm">
                    <Sparkles className="w-3 h-3" />
                    Demo graph · search above to explore your live knowledge
                    base
                  </div>
                </Panel>
              )}
            </ReactFlow>
          </div>
        ) : (
          /* ── Empty / onboarding state ── */
          <div className="grid gap-4 p-6 lg:grid-cols-[1.45fr_1fr]">
            <div className="rounded-2xl border border-border/30 bg-card/50 p-5 space-y-4">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                  <Sparkles className="h-3 w-3" /> Graph explorer
                </div>
                <h4 className="text-base font-semibold text-foreground">
                  {liveCount > 0
                    ? `Search the ${scopeLabel} graph`
                    : `No live graph for ${scopeLabel}`}
                </h4>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {liveCount > 0
                    ? "Enter a business term to see how entities, policies, and concepts connect across your knowledge base."
                    : "Once documents are indexed and entities are extracted, this canvas shows how your knowledge fits together."}
                </p>
              </div>

              {!hasTaxonomy && (
                <div className="rounded-xl border border-dashed border-primary/25 bg-primary/5 p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
                      <Tags className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        No taxonomy yet
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        Create categories to organize content. A taxonomy makes
                        the knowledge graph much easier to navigate.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={loadDemo}
                  className={cn(k.btnPrimary, "text-xs")}
                >
                  <Sparkles className="h-3.5 w-3.5" /> Preview sample graph
                </button>
                {onOpenTaxonomy && (
                  <button
                    onClick={onOpenTaxonomy}
                    className={cn(k.btnSecondary, "text-xs")}
                  >
                    <Tags className="h-3.5 w-3.5" /> Open taxonomy
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border/30 bg-card/50 p-5 space-y-4">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  What the graph shows
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Entity relationships extracted from your documents — people,
                  policies, concepts, and how they connect.
                </p>
              </div>
              <div className="space-y-1.5">
                {demoPreset.nodes.slice(0, 4).map(node => {
                  const cfg = getTypeCfg(node.type);
                  return (
                    <div
                      key={node.id}
                      className="flex items-center gap-2.5 rounded-xl bg-background/60 px-3 py-2"
                    >
                      <div
                        className="h-6 w-6 shrink-0 rounded-md flex items-center justify-center"
                        style={{ backgroundColor: `${cfg.color}1e` }}
                      >
                        <cfg.Icon
                          className="w-3.5 h-3.5"
                          style={{ color: cfg.color }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground truncate">
                          {node.label}
                        </p>
                        <p className="text-[10px] text-muted-foreground capitalize">
                          {node.type}
                        </p>
                      </div>
                      <ChevronRight className="w-3 h-3 text-muted-foreground/30 shrink-0" />
                    </div>
                  );
                })}
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-2">
                  Suggested searches
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {demoPreset.suggestedQueries.map(q => (
                    <button
                      key={q}
                      onClick={() => runSearch(q)}
                      className="rounded-full border border-border/30 px-3 py-1 text-[11px] font-medium text-foreground kb-duotone-border-hover-strong kb-duotone-text-hover transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Selected node detail panel ── */}
      {selectedNode &&
        (() => {
          const cfg = getTypeCfg(selectedNode.data.entityType);
          return (
            <div className={cn(cardCls, "overflow-hidden")}>
              <div className="border-b border-border/30 px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className="h-8 w-8 shrink-0 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${cfg.color}1e` }}
                  >
                    <cfg.Icon
                      className="w-4 h-4"
                      style={{ color: cfg.color }}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground leading-tight">
                      {selectedNode.data.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground capitalize">
                      {cfg.label}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedId(null);
                    setNodes(prev =>
                      prev.map(n => ({
                        ...n,
                        data: { ...n.data, isDimmed: false },
                      }))
                    );
                  }}
                  className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-muted/60 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="px-5 py-4 flex items-center gap-6">
                {[
                  { label: "Connections", value: selectedConnections },
                  { label: "Mentions", value: selectedNode.data.mentionCount },
                  {
                    label: "Status",
                    value: selectedNode.data.isExpanded
                      ? "Expanded"
                      : isDemoGraph
                        ? "Demo"
                        : "Click to expand",
                  },
                ].map(stat => (
                  <div key={stat.label}>
                    <p className="text-base font-bold text-foreground tabular-nums">
                      {stat.value}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {stat.label}
                    </p>
                  </div>
                ))}
                {!isDemoGraph &&
                  !selectedNode.data.isExpanded &&
                  !selectedNode.data.isExpanding && (
                    <button
                      onClick={() =>
                        handleNodeClick({} as any, selectedNode, nodes)
                      }
                      className={cn(k.btnSecondary, "ml-auto text-xs")}
                    >
                      Expand neighborhood
                    </button>
                  )}
              </div>
            </div>
          );
        })()}
    </div>
  );
}

// ── Public export (wraps core with ReactFlowProvider) ─────────────────────────

export interface EntityGraphProps {
  selectedStream?: string;
  streamLabel?: string;
  onOpenTaxonomy?: () => void;
}

export default function EntityGraph(props: EntityGraphProps) {
  return (
    <ReactFlowProvider>
      <EntityGraphCore {...props} />
    </ReactFlowProvider>
  );
}
