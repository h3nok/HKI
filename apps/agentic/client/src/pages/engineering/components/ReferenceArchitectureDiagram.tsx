import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Handle,
  Position,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
  type NodeTypes,
  type EdgeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Check,
  Clipboard,
  LocateFixed,
  Maximize2,
  Minimize2,
  RotateCcw,
} from "lucide-react";

import { cn } from "@hki/ui";

import {
  ARCHITECTURE_COLORS,
  PLANES,
  PLANE_ORDER,
  type PlaneId,
} from "./architecture/planes";
import {
  ARCH_NODES,
  ARCH_EDGES,
  VIEW_META,
  type ArchNode,
  type ViewMode,
} from "./architecture/graph";
import { layoutArchGraph, NODE_DIMENSIONS } from "./architecture/layout";

/* ─── Custom node ─────────────────────────────────────────────────────── */

type StageNodeData = {
  arch: ArchNode;
  selected: boolean;
  onPath: boolean;
  onSelect: (id: string) => void;
};

const HANDLE_STYLE: React.CSSProperties = {
  opacity: 0,
  width: 6,
  height: 6,
  background: "transparent",
  border: 0,
};

const SURFACE = ARCHITECTURE_COLORS.surface;
const STATUS = ARCHITECTURE_COLORS.status;

function primitiveButtonStyle(
  accent: string = STATUS.focus
): React.CSSProperties {
  return {
    background: SURFACE.panelRaised,
    borderColor: SURFACE.border,
    color: accent,
  };
}

const StageNode = memo(({ data }: NodeProps<Node<StageNodeData>>) => {
  const { arch, selected, onPath, onSelect } = data;
  const Icon = arch.icon;
  const accent = PLANES[arch.plane].accent;

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${arch.label} — ${arch.short}`}
      onClick={() => onSelect(arch.id)}
      className={cn(
        "group relative block rounded-lg border px-3 py-2.5 text-left shadow-xs backdrop-blur-sm transition-all outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        selected
          ? "shadow-md"
          : onPath
            ? "hover:shadow-md"
            : "opacity-60 hover:opacity-100"
      )}
      style={{
        width: NODE_DIMENSIONS.width,
        height: NODE_DIMENSIONS.height,
        background: SURFACE.panel,
        borderColor: selected
          ? accent
          : onPath
            ? SURFACE.border
            : SURFACE.borderMuted,
        color: SURFACE.text,
        ...(selected
          ? {
              boxShadow: `0 0 0 2px ${accent}, 0 16px 32px -26px ${SURFACE.shadow}`,
            }
          : {}),
      }}
    >
      <span
        aria-hidden
        className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r"
        style={{ background: accent }}
      />

      <div className="flex items-center gap-1.5 pl-1.5">
        <span
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center"
          style={{ color: onPath ? accent : SURFACE.textSubtle }}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span
          className="truncate text-[12px] font-bold leading-tight"
          style={{ color: SURFACE.text }}
        >
          {arch.label}
        </span>
      </div>
      <div
        className="mt-1 truncate pl-1.5 text-[10.5px] leading-tight"
        style={{
          color: onPath ? SURFACE.textMuted : SURFACE.textSubtle,
        }}
      >
        {arch.short}
      </div>

      {selected && (
        <span
          aria-hidden
          className="absolute -right-1 -top-1 inline-flex h-2 w-2 rounded-full"
          style={{
            background: accent,
            boxShadow: `0 0 0 2px ${SURFACE.panel}`,
          }}
        />
      )}

      <Handle
        id="t"
        type="target"
        position={Position.Top}
        style={HANDLE_STYLE}
      />
      <Handle
        id="b"
        type="source"
        position={Position.Bottom}
        style={HANDLE_STYLE}
      />
      <Handle
        id="l"
        type="target"
        position={Position.Left}
        style={HANDLE_STYLE}
      />
      <Handle
        id="r"
        type="source"
        position={Position.Right}
        style={HANDLE_STYLE}
      />
    </button>
  );
});
StageNode.displayName = "StageNode";

/* ─── Plane band node (background lane) ───────────────────────────────── */

type PlaneNodeData = { plane: PlaneId; width: number; height: number };

const PlaneNode = memo(({ data }: NodeProps<Node<PlaneNodeData>>) => {
  const tok = PLANES[data.plane];
  return (
    <div
      className="pointer-events-none rounded-lg"
      style={{
        width: data.width,
        height: data.height,
        background: tok.tintBg,
        border: `1px dashed ${tok.tintBorder}`,
        position: "relative",
      }}
    >
      <div
        className="absolute left-3 top-2 inline-flex items-center gap-2 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em]"
        style={{
          color: tok.accent,
          background: SURFACE.panel,
          border: `1px solid ${tok.tintBorder}`,
        }}
      >
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: tok.accent }}
        />
        {tok.label}
        <span
          className="text-[9px] font-medium normal-case tracking-normal"
          style={{
            color: SURFACE.textMuted,
          }}
        >
          · {tok.sub}
        </span>
      </div>
    </div>
  );
});
PlaneNode.displayName = "PlaneNode";

/* ─── Custom edge ─────────────────────────────────────────────────────── */

type PlaneEdgeData = {
  accent: string;
  dim: boolean;
  dashed: boolean;
  label?: string;
};

function PlaneEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps<Edge<PlaneEdgeData>>) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature: 0.32,
  });

  const accent = data?.accent ?? SURFACE.text;
  const dim = !!data?.dim;
  const dashed = !!data?.dashed;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: dim ? STATUS.dimEdge : accent,
          strokeWidth: dim ? 1 : 1.6,
          strokeDasharray: dashed ? "5 4" : undefined,
          filter: dim ? undefined : `drop-shadow(0 0 2px ${accent})`,
        }}
        markerEnd={markerEnd}
      />
      {!dim && !dashed && (
        <circle r={2.6} fill={accent}>
          <animateMotion dur="3.4s" repeatCount="indefinite" path={path} />
          <animate
            attributeName="opacity"
            values="0;1;1;0"
            keyTimes="0;0.1;0.9;1"
            dur="3.4s"
            repeatCount="indefinite"
          />
        </circle>
      )}
      {data?.label && !dim && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none rounded-sm px-1 py-px text-[9px] font-semibold uppercase tracking-wider"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              color: accent,
              background: SURFACE.panel,
              border: `1px solid ${SURFACE.borderMuted}`,
            }}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const NODE_TYPES: NodeTypes = {
  stage: StageNode,
  plane: PlaneNode,
};

const EDGE_TYPES: EdgeTypes = {
  plane: PlaneEdge,
};

type CopyTarget = "node" | "path";

function getPathNodes(view: ViewMode) {
  return ARCH_NODES.filter(n => n.highlight.includes(view));
}

function formatNodeSummary(arch: ArchNode) {
  return [
    `${arch.label} (${PLANES[arch.plane].label})`,
    `Job: ${arch.job}`,
    `Enforces: ${arch.enforces}`,
    `Rejects: ${arch.rejects}`,
    `Surface: ${arch.surface}`,
  ].join("\n");
}

function formatPathSummary(view: ViewMode, nodes: readonly ArchNode[]) {
  return [
    `${VIEW_META[view].label}: ${VIEW_META[view].tagline}`,
    "",
    ...nodes.map((n, i) => `${i + 1}. ${n.label} - ${n.short}`),
  ].join("\n");
}

/* ─── Build flow ─────────────────────────────────────────────────────── */

const PLANE_PADDING_X = 32;
const PLANE_PADDING_Y = 36;

function buildFlow(
  view: ViewMode,
  selectedId: string,
  onSelect: (id: string) => void
) {
  const layout = layoutArchGraph(ARCH_NODES);

  const planeNodes: Node[] = layout.bands.map(band => {
    const w = layout.width + PLANE_PADDING_X * 2;
    const h = band.height + PLANE_PADDING_Y * 2;
    return {
      id: `plane-${band.plane}`,
      type: "plane",
      position: {
        x: -PLANE_PADDING_X,
        y: band.y - PLANE_PADDING_Y,
      },
      data: {
        plane: band.plane,
        width: w,
        height: h,
      },
      width: w,
      height: h,
      draggable: false,
      selectable: false,
      focusable: false,
      style: { zIndex: 0, width: w, height: h },
    };
  });

  const stageNodes: Node[] = layout.nodes.map(n => ({
    id: n.id,
    type: "stage",
    position: { x: n.x, y: n.y },
    data: {
      arch: n,
      selected: n.id === selectedId,
      onPath: n.highlight.includes(view),
      onSelect,
    },
    width: NODE_DIMENSIONS.width,
    height: NODE_DIMENSIONS.height,
    draggable: false,
    style: {
      zIndex: 10,
      width: NODE_DIMENSIONS.width,
      height: NODE_DIMENSIONS.height,
    },
  }));

  const edges: Edge[] = ARCH_EDGES.map((e, i) => {
    const isOnView = e.mode === view;
    const fromNode = ARCH_NODES.find(n => n.id === e.from);
    const accent = fromNode ? PLANES[fromNode.plane].accent : SURFACE.text;

    return {
      id: `${e.from}->${e.to}-${e.mode}-${i}`,
      source: e.from,
      target: e.to,
      type: "plane",
      data: {
        accent,
        dim: !isOnView,
        dashed: e.kind === "dashed",
        label: e.label,
      },
      animated: false,
      zIndex: isOnView ? 5 : 1,
    };
  });

  return { nodes: [...planeNodes, ...stageNodes], edges };
}

/* ─── Inspector panel ─────────────────────────────────────────────────── */

function InspectorField({
  label,
  children,
  tone = "default",
}: {
  label: string;
  children: React.ReactNode;
  tone?: "default" | "primary" | "danger";
}) {
  const labelColor =
    tone === "primary"
      ? STATUS.focus
      : tone === "danger"
        ? STATUS.danger
        : SURFACE.textSubtle;

  return (
    <div
      className="rounded-lg border p-3"
      style={{
        background: SURFACE.panelRaised,
        borderColor: SURFACE.borderMuted,
      }}
    >
      <p
        className="text-[10px] font-bold uppercase tracking-[0.14em]"
        style={{ color: labelColor }}
      >
        {label}
      </p>
      <div
        className="mt-2 text-[13px] leading-6"
        style={{ color: SURFACE.textMuted }}
      >
        {children}
      </div>
    </div>
  );
}

function InspectorPanel({
  view,
  arch,
  selectedId,
  expanded,
  onSelect,
  onViewChange,
  onFit,
  onCenterSelected,
  onToggleExpanded,
  onCopy,
  copied,
}: {
  view: ViewMode;
  arch: ArchNode;
  selectedId: string;
  expanded: boolean;
  onSelect: (id: string) => void;
  onViewChange: (v: ViewMode) => void;
  onFit: () => void;
  onCenterSelected: () => void;
  onToggleExpanded: () => void;
  onCopy: (target: CopyTarget) => void;
  copied: CopyTarget | null;
}) {
  const Icon = arch.icon;
  const tok = PLANES[arch.plane];
  const pathNodes = getPathNodes(view);

  return (
    <aside
      className="flex min-h-0 flex-col border-b lg:border-b-0 lg:border-r"
      style={{
        background: SURFACE.panel,
        borderColor: SURFACE.border,
      }}
    >
      <div className="border-b p-4" style={{ borderColor: SURFACE.border }}>
        <p
          className="text-[10px] font-bold uppercase tracking-[0.18em]"
          style={{ color: SURFACE.textSubtle }}
        >
          Reference architecture
        </p>
        <h2
          className="mt-2 text-xl font-extrabold leading-tight tracking-tight"
          style={{ color: SURFACE.text }}
        >
          HKI flow inspector
        </h2>
        <p
          className="mt-2 text-sm font-semibold leading-6"
          style={{ color: SURFACE.textMuted }}
        >
          {VIEW_META[view].tagline}
        </p>

        <div
          className="mt-4 grid grid-cols-3 overflow-hidden rounded-lg border text-center"
          style={{
            background: SURFACE.panelRaised,
            borderColor: SURFACE.border,
          }}
        >
          {[
            { label: "Nodes", value: ARCH_NODES.length },
            { label: "Edges", value: ARCH_EDGES.length },
            { label: "Planes", value: PLANE_ORDER.length },
          ].map((stat, index) => (
            <div
              key={stat.label}
              className="px-2 py-2"
              style={{
                borderRight:
                  index === 2 ? undefined : `1px solid ${SURFACE.border}`,
              }}
            >
              <p
                className="text-lg font-extrabold tabular-nums"
                style={{ color: SURFACE.text }}
              >
                {stat.value}
              </p>
              <p
                className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.12em]"
                style={{ color: SURFACE.textSubtle }}
              >
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        <div
          role="tablist"
          aria-label="Architecture path"
          className="mt-4 grid gap-1.5"
        >
          {(["runtime", "publication", "admin"] as const).map(v => {
            const active = view === v;
            const PathIcon = VIEW_META[v].icon;
            return (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onViewChange(v)}
                className="flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-[12px] font-bold transition-all hover:opacity-85"
                style={{
                  background: active ? STATUS.focus : SURFACE.panelRaised,
                  borderColor: active ? STATUS.focus : SURFACE.border,
                  color: active ? SURFACE.panel : SURFACE.textMuted,
                  boxShadow: active
                    ? `0 12px 26px -20px ${STATUS.focus}`
                    : undefined,
                }}
              >
                <PathIcon className="h-3.5 w-3.5 shrink-0" />
                {VIEW_META[v].label}
              </button>
            );
          })}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={onFit}
            className="inline-flex items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-[11px] font-semibold transition-opacity hover:opacity-80"
            style={primitiveButtonStyle()}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Fit
          </button>
          <button
            type="button"
            onClick={onCenterSelected}
            className="inline-flex items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-[11px] font-semibold transition-opacity hover:opacity-80"
            style={primitiveButtonStyle()}
          >
            <LocateFixed className="h-3.5 w-3.5" />
            Node
          </button>
          <button
            type="button"
            onClick={onToggleExpanded}
            className="inline-flex items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-[11px] font-semibold transition-opacity hover:opacity-80"
            style={primitiveButtonStyle()}
          >
            {expanded ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
            {expanded ? "Exit" : "Full"}
          </button>
        </div>
      </div>

      <div className="border-b p-4" style={{ borderColor: SURFACE.border }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p
              className="text-[10px] font-bold uppercase tracking-[0.16em]"
              style={{ color: SURFACE.textSubtle }}
            >
              Path steps
            </p>
            <p
              className="mt-1 text-xs leading-5"
              style={{ color: SURFACE.textMuted }}
            >
              Select a node to inspect enforcement at that boundary.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onCopy("path")}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-opacity hover:opacity-80"
            style={primitiveButtonStyle()}
            aria-label="Copy path summary"
          >
            {copied === "path" ? (
              <Check className="h-3.5 w-3.5" style={{ color: STATUS.focus }} />
            ) : (
              <Clipboard className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
        <div className="mt-3 grid gap-1.5">
          {pathNodes.map((node, index) => {
            const active = node.id === selectedId;
            const StepIcon = node.icon;
            return (
              <button
                key={node.id}
                type="button"
                onClick={() => onSelect(node.id)}
                className="flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-opacity hover:opacity-85"
                style={{
                  background: active ? SURFACE.panelMuted : SURFACE.panelRaised,
                  borderColor: active ? STATUS.focus : SURFACE.borderMuted,
                  color: active ? SURFACE.text : SURFACE.textMuted,
                  boxShadow: active
                    ? `0 10px 22px -18px ${STATUS.focus}`
                    : undefined,
                }}
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold tabular-nums"
                  style={{
                    borderColor: active ? STATUS.focus : SURFACE.border,
                    background: active ? SURFACE.panel : SURFACE.panelRaised,
                    color: active ? STATUS.focus : SURFACE.textSubtle,
                  }}
                >
                  {index + 1}
                </span>
                <StepIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0">
                  <span className="block truncate text-[12px] font-semibold">
                    {node.label}
                  </span>
                  <span
                    className="block truncate text-[10.5px]"
                    style={{
                      color: active ? SURFACE.textMuted : SURFACE.textSubtle,
                    }}
                  >
                    {node.short}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-md"
              style={{
                background: tok.tintBg,
                border: `1px solid ${tok.tintBorder}`,
                color: tok.accent,
              }}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <p
                className="truncate text-[13px] font-bold"
                style={{ color: SURFACE.text }}
              >
                {arch.label}
              </p>
              <p
                className="text-[10px] font-bold uppercase tracking-[0.14em]"
                style={{ color: tok.accent }}
              >
                {tok.label}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onCopy("node")}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-opacity hover:opacity-80"
            style={primitiveButtonStyle(tok.accent)}
            aria-label="Copy selected node summary"
          >
            {copied === "node" ? (
              <Check className="h-3.5 w-3.5" style={{ color: STATUS.focus }} />
            ) : (
              <Clipboard className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        <InspectorField label="Boundary job">{arch.job}</InspectorField>
        <InspectorField label="HKI invariant enforced here" tone="primary">
          {arch.enforces}
        </InspectorField>
        <InspectorField label="Failure rejected" tone="danger">
          {arch.rejects}
        </InspectorField>
        <div>
          <p
            className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em]"
            style={{ color: SURFACE.textSubtle }}
          >
            Implementation surface
          </p>
          <code
            className="block break-all rounded-md border px-2 py-1.5 font-mono text-[11px]"
            style={{
              background: SURFACE.panelRaised,
              borderColor: SURFACE.borderMuted,
              color: SURFACE.textMuted,
            }}
          >
            {arch.surface}
          </code>
        </div>
      </div>
    </aside>
  );
}

/* ─── Legend ──────────────────────────────────────────────────────────── */

function Legend() {
  return (
    <div
      className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t px-4 py-2.5 text-[11px] sm:px-5"
      style={{
        background: SURFACE.panelRaised,
        borderColor: SURFACE.border,
        color: SURFACE.textMuted,
      }}
    >
      {PLANE_ORDER.map(p => (
        <span key={p} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{
              background: PLANES[p].tintBg,
              border: `1px solid ${PLANES[p].tintBorder}`,
            }}
          />
          <span className="font-medium" style={{ color: SURFACE.text }}>
            {PLANES[p].label}
          </span>
        </span>
      ))}
      <span className="ml-auto inline-flex items-center gap-1.5">
        <span
          className="inline-block h-0 w-5 border-t-2 border-dashed"
          style={{ borderColor: SURFACE.textSubtle }}
        />
        Async / cache
      </span>
    </div>
  );
}

/* ─── Inner ───────────────────────────────────────────────────────────── */

function DiagramInner() {
  const [view, setView] = useState<ViewMode>("runtime");
  const [selectedId, setSelectedId] = useState<string>("gateway");
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState<CopyTarget | null>(null);

  const handleSelect = useCallback((id: string) => setSelectedId(id), []);

  const { nodes, edges } = useMemo(
    () => buildFlow(view, selectedId, handleSelect),
    [view, selectedId, handleSelect]
  );

  const selected = useMemo(
    () => ARCH_NODES.find(n => n.id === selectedId) ?? ARCH_NODES[0],
    [selectedId]
  );

  const pathNodes = useMemo(() => getPathNodes(view), [view]);

  const rf = useReactFlow();
  const fitDiagram = useCallback(() => {
    rf.fitView({
      nodes: pathNodes.map(n => ({ id: n.id })),
      padding: expanded ? 0.16 : 0.22,
      duration: 320,
    });
  }, [expanded, pathNodes, rf]);

  const centerSelected = useCallback(() => {
    const node = rf.getNode(selectedId);
    if (!node) return;
    rf.setCenter(
      node.position.x + NODE_DIMENSIONS.width / 2,
      node.position.y + NODE_DIMENSIONS.height / 2,
      { zoom: expanded ? 1.15 : 1.05, duration: 320 }
    );
  }, [expanded, rf, selectedId]);

  const copySummary = useCallback(
    (target: CopyTarget) => {
      const text =
        target === "path"
          ? formatPathSummary(view, pathNodes)
          : formatNodeSummary(selected);
      void navigator.clipboard?.writeText(text);
      setCopied(target);
      window.setTimeout(() => setCopied(null), 1400);
    },
    [pathNodes, selected, view]
  );

  useEffect(() => {
    if (selected.highlight.includes(view)) return;
    setSelectedId(pathNodes[0]?.id ?? "gateway");
  }, [pathNodes, selected.highlight, view]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      fitDiagram();
    }, 60);
    return () => window.clearTimeout(t);
  }, [expanded, fitDiagram, view]);

  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [expanded]);

  return (
    <>
      {expanded && (
        <div
          className="fixed inset-0 z-50 backdrop-blur-sm"
          style={{ background: SURFACE.overlay }}
        />
      )}
      <div
        className={cn(
          "overflow-hidden rounded-xl border shadow-surface",
          expanded && "fixed inset-4 z-60 flex flex-col shadow-2xl"
        )}
        style={{
          background: SURFACE.panel,
          borderColor: SURFACE.border,
        }}
      >
        <div className="grid min-h-0 flex-1 lg:grid-cols-[360px_minmax(0,1fr)]">
          <InspectorPanel
            view={view}
            arch={selected}
            selectedId={selectedId}
            expanded={expanded}
            onSelect={handleSelect}
            onViewChange={setView}
            onFit={fitDiagram}
            onCenterSelected={centerSelected}
            onToggleExpanded={() => setExpanded(v => !v)}
            onCopy={copySummary}
            copied={copied}
          />

          <div
            className="hki-rf-host relative"
            style={{
              background: `linear-gradient(180deg, ${SURFACE.page} 0%, ${SURFACE.panel} 100%)`,
              height: expanded ? "calc(100vh - 92px)" : "calc(100vh - 154px)",
              minHeight: 620,
            }}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={NODE_TYPES}
              edgeTypes={EDGE_TYPES}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              panOnDrag
              zoomOnScroll
              panOnScroll
              minZoom={0.35}
              maxZoom={2}
              defaultViewport={{ x: 0, y: 0, zoom: 0.95 }}
              proOptions={{ hideAttribution: true }}
              className="hki-rf"
            >
              <style>{`
                .hki-rf-controls {
                  background: ${SURFACE.panel} !important;
                  border: 1px solid ${SURFACE.border} !important;
                  border-radius: 8px !important;
                  box-shadow: 0 18px 34px -28px ${SURFACE.shadow} !important;
                  overflow: hidden;
                }
                .hki-rf-controls button {
                  background: ${SURFACE.panel} !important;
                  border-bottom: 1px solid ${SURFACE.borderMuted} !important;
                  color: ${SURFACE.textMuted} !important;
                  fill: ${SURFACE.textMuted} !important;
                }
                .hki-rf-controls button:hover {
                  background: ${SURFACE.panelRaised} !important;
                  color: ${SURFACE.text} !important;
                  fill: ${SURFACE.text} !important;
                }
              `}</style>
              <Background
                variant={BackgroundVariant.Dots}
                gap={18}
                size={1}
                color={SURFACE.grid}
              />
              <Controls
                showInteractive={false}
                className="hki-rf-controls"
                position="bottom-right"
              />
              <MiniMap
                pannable
                zoomable
                position="top-right"
                maskColor={SURFACE.minimapMask}
                nodeColor={n => {
                  if (n.type === "plane")
                    return PLANES[(n.data as PlaneNodeData).plane].tintBg;
                  const arch = (n.data as StageNodeData)?.arch;
                  return arch ? PLANES[arch.plane].accent : SURFACE.panelRaised;
                }}
                nodeStrokeColor={SURFACE.panel}
                style={{
                  background: SURFACE.panel,
                  border: `1px solid ${SURFACE.border}`,
                  borderRadius: 8,
                  width: expanded ? 170 : 150,
                  height: expanded ? 108 : 96,
                }}
              />
            </ReactFlow>
          </div>
        </div>

        <Legend />
      </div>
    </>
  );
}

/* ─── Public ──────────────────────────────────────────────────────────── */

export function ReferenceArchitectureDiagram({
  className,
}: {
  className?: string;
}) {
  return (
    <div className={cn(className)}>
      <ReactFlowProvider>
        <DiagramInner />
      </ReactFlowProvider>
    </div>
  );
}

export type { ViewMode } from "./architecture/graph";
