/**
 * Layered layout: places nodes by plane band → layer row → slot column.
 * Deterministic, dependency-free. Coordinates are in React Flow units (px).
 */

import type { ArchNode } from "./graph";
import { PLANE_ORDER, type PlaneId } from "./planes";

export type LayoutOptions = {
  /** Width allocated per node slot (px). */
  colWidth: number;
  /** Height allocated per layer row (px). */
  rowHeight: number;
  /** Vertical gap between planes (px). */
  planeGap: number;
  /** Top padding for the first plane label (px). */
  topPadding: number;
};

const DEFAULTS: LayoutOptions = {
  colWidth: 214,
  rowHeight: 112,
  planeGap: 52,
  topPadding: 30,
};

export type PlaneBand = {
  plane: PlaneId;
  /** Top y in layout px. */
  y: number;
  /** Height in layout px. */
  height: number;
  /** Number of layer rows in this plane. */
  layers: number;
};

export type LaidOutNode = ArchNode & {
  x: number;
  y: number;
  /** Width / height of the rendered node card. */
  width: number;
  height: number;
};

export type LayoutResult = {
  nodes: LaidOutNode[];
  bands: PlaneBand[];
  /** Total layout extents (px). */
  width: number;
  height: number;
};

const NODE_WIDTH = 196;
const NODE_HEIGHT = 74;

/** Group nodes by plane → layer → slot. */
function groupNodes(nodes: readonly ArchNode[]) {
  const byPlane = new Map<PlaneId, ArchNode[]>();
  for (const n of nodes) {
    const arr = byPlane.get(n.plane) ?? [];
    arr.push(n);
    byPlane.set(n.plane, arr);
  }
  return byPlane;
}

/** Maximum slot index per plane, used to centre layers. */
function planeWidth(planeNodes: ArchNode[], colWidth: number) {
  const slotsByLayer = new Map<number, number>();
  for (const n of planeNodes) {
    slotsByLayer.set(n.layer, Math.max(slotsByLayer.get(n.layer) ?? 0, n.slot));
  }
  const maxSlot = Math.max(0, ...Array.from(slotsByLayer.values()));
  return (maxSlot + 1) * colWidth;
}

export function layoutArchGraph(
  nodes: readonly ArchNode[],
  options: Partial<LayoutOptions> = {}
): LayoutResult {
  const opts = { ...DEFAULTS, ...options };
  const grouped = groupNodes(nodes);

  // Determine global width (widest plane) so every plane can centre against it.
  const widestPlane = Math.max(
    ...PLANE_ORDER.map(p => planeWidth(grouped.get(p) ?? [], opts.colWidth))
  );
  const totalWidth = widestPlane;

  const bands: PlaneBand[] = [];
  const laidOut: LaidOutNode[] = [];
  let cursorY = opts.topPadding;

  for (const plane of PLANE_ORDER) {
    const planeNodes = grouped.get(plane) ?? [];
    if (planeNodes.length === 0) continue;

    const layers = Math.max(0, ...planeNodes.map(n => n.layer)) + 1;
    const bandHeight = layers * opts.rowHeight;

    bands.push({
      plane,
      y: cursorY,
      height: bandHeight,
      layers,
    });

    // Layout nodes in this plane
    const slotsByLayer = new Map<number, number>();
    for (const n of planeNodes) {
      slotsByLayer.set(
        n.layer,
        Math.max(slotsByLayer.get(n.layer) ?? 0, n.slot)
      );
    }

    for (const n of planeNodes) {
      const layerSlots = (slotsByLayer.get(n.layer) ?? 0) + 1;
      const layerWidth = layerSlots * opts.colWidth;
      const layerLeft = (totalWidth - layerWidth) / 2;
      const x =
        layerLeft + n.slot * opts.colWidth + (opts.colWidth - NODE_WIDTH) / 2;
      const y =
        cursorY + n.layer * opts.rowHeight + (opts.rowHeight - NODE_HEIGHT) / 2;
      laidOut.push({ ...n, x, y, width: NODE_WIDTH, height: NODE_HEIGHT });
    }

    cursorY += bandHeight + opts.planeGap;
  }

  return {
    nodes: laidOut,
    bands,
    width: totalWidth,
    height: cursorY,
  };
}

export const NODE_DIMENSIONS = { width: NODE_WIDTH, height: NODE_HEIGHT };
