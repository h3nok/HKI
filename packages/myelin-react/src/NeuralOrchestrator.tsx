import React, { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import type { NodeRole, OrchestratorTopology } from "@myelin/core";
import { hkiTheme, type NeuralOrchestratorTheme } from "./themes/index.js";

/* ────────────────────────────────────────────────────────────────────────────
   NEURAL ORCHESTRATOR — live 3D projection of an agentic workflow graph.

   Engineering invariants (§6 of docs/myelin/DESIGN.md):
   - Deterministic layout: mulberry32(seed), never Math.random()
   - No React state in RAF loop: refs + throttled flush (≤5/s)
   - One LineSegments draw call for all edges (vertexColors)
   - Fixed MAX_SIG=64 signal buffer; slots reused via .active flag
   - All Three.js colors from theme prop, never hardcoded
   - All overlay panel colors from CSS custom properties, never hardcoded
   - Full cleanup on unmount
   ──────────────────────────────────────────────────────────────────────────── */

// ─── Deterministic RNG ────────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fibonacci sphere — even distribution across sphere surface
function fib(i: number, n: number, r: number): THREE.Vector3 {
  const phi = Math.acos(1 - (2 * (i + 0.5)) / n);
  const theta = Math.PI * (1 + Math.sqrt(5)) * (i + 0.5);
  return new THREE.Vector3(
    Math.cos(theta) * Math.sin(phi) * r,
    Math.sin(theta) * Math.sin(phi) * r,
    Math.cos(phi) * r
  );
}

// ─── Internal graph types ─────────────────────────────────────────────────────

interface GNode {
  id: number;
  key: string;
  role: NodeRole;
  label: string;
  rel: string;
  pos: THREE.Vector3;
  size: number;
  _base: THREE.Color;
  _hot: THREE.Color;
}

interface InternalGraph {
  nodes: GNode[];
  edges: [number, number][];
  adj: Map<string, number>;
  neighbors: Array<Array<[number, number]>>;
}

// ─── Default HKI fixture topology ────────────────────────────────────────────

const DEFAULT_AGENTS = [
  "Planner",
  "Router",
  "Researcher",
  "Coder",
  "Critic",
  "Synthesizer",
  "Guardrail",
];
const DEFAULT_TOOLS: Array<{ l: string; role: NodeRole }> = [
  { l: "Vector Store", role: "persist" },
  { l: "Neo4j Graph", role: "persist" },
  { l: "Memory", role: "persist" },
  { l: "Cache", role: "persist" },
  { l: "Web Search", role: "tool" },
  { l: "Code Runner", role: "tool" },
  { l: "SQL Tool", role: "tool" },
  { l: "Browser", role: "tool" },
  { l: "Embedder", role: "tool" },
  { l: "Reranker", role: "tool" },
  { l: "File IO", role: "tool" },
  { l: "Scheduler", role: "tool" },
  { l: "LLM · GPT-4o", role: "tool" },
  { l: "LLM · Claude", role: "tool" },
];

// ─── Graph builder ────────────────────────────────────────────────────────────

function buildGraph(
  theme: NeuralOrchestratorTheme,
  topology?: OrchestratorTopology
): InternalGraph {
  const rng = mulberry32(73);
  const mk = (hex: number) => new THREE.Color(hex);

  const nodes: GNode[] = [];

  const pushNode = (
    key: string,
    role: NodeRole,
    label: string,
    rel: string,
    pos: THREE.Vector3,
    size: number
  ) => {
    const base = mk(theme.nodes[role]);
    nodes.push({
      id: nodes.length,
      key,
      role,
      label,
      rel,
      pos,
      size,
      _base: base.clone(),
      _hot: base.clone().lerp(mk(0xffffff), 0.72),
    });
  };

  if (topology && topology.nodes.length > 0) {
    const byRole = (r: NodeRole) => topology.nodes.filter(n => n.role === r);
    const orch = byRole("orchestrator");
    const agents = byRole("agent");
    const outer = [...byRole("tool"), ...byRole("persist")];
    orch.forEach(n =>
      pushNode(n.id, n.role, n.label, n.rel, new THREE.Vector3(0, 0, 0), 13)
    );
    agents.forEach((n, i) =>
      pushNode(
        n.id,
        n.role,
        n.label,
        n.rel,
        fib(i, Math.max(agents.length, 1), 42),
        3.3
      )
    );
    outer.forEach((n, i) =>
      pushNode(
        n.id,
        n.role,
        n.label,
        n.rel,
        fib(i, Math.max(outer.length, 1), 74),
        2.6
      )
    );
  } else {
    pushNode(
      "hki-orchestrator",
      "orchestrator",
      "HKI ORCHESTRATOR",
      "ROUTES_TO",
      new THREE.Vector3(0, 0, 0),
      13
    );
    DEFAULT_AGENTS.forEach((l, i) =>
      pushNode(
        `agent-${i}`,
        "agent",
        l,
        "INVOKES",
        fib(i, DEFAULT_AGENTS.length, 42),
        3.3
      )
    );
    DEFAULT_TOOLS.forEach((t, i) =>
      pushNode(
        `${t.role}-${i}`,
        t.role,
        t.l,
        t.role === "persist" ? "PERSISTS_TO" : "CALLS",
        fib(i, DEFAULT_TOOLS.length, 74),
        2.6
      )
    );
  }

  const aStart = topology ? nodes.findIndex(n => n.role === "agent") : 1;
  const aEnd =
    aStart < 0
      ? 1
      : nodes.reduce((m, n, i) => (n.role === "agent" ? i + 1 : m), aStart);
  const tStart = aEnd;

  const edges: [number, number][] = [];
  const adj = new Map<string, number>();
  const neighbors: Array<Array<[number, number]>> = nodes.map(() => []);

  const link = (a: number, b: number) => {
    if (a === b || a < 0 || b < 0) return;
    const k = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (adj.has(k)) return;
    const ei = edges.length;
    adj.set(k, ei);
    edges.push([a, b]);
    neighbors[a]!.push([b, ei]);
    neighbors[b]!.push([a, ei]);
  };

  if (topology && topology.edges.length > 0) {
    const idToIdx = new Map(nodes.map((n, i) => [n.key, i]));
    topology.edges.forEach(e => {
      const a = idToIdx.get(e.source) ?? -1;
      const b = idToIdx.get(e.target) ?? -1;
      link(a, b);
    });
  } else {
    for (let a = aStart; a < aEnd; a++) link(0, a);
    [
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 7],
      [2, 5],
      [1, 4],
    ].forEach(([i, j]) => link(i!, j!));
    for (let a = aStart; a < aEnd; a++) {
      const k = 2 + Math.floor(rng() * 3);
      const pool = [...Array(DEFAULT_TOOLS.length).keys()]
        .sort(() => rng() - 0.5)
        .slice(0, k);
      pool.forEach(t => link(a, tStart + t));
    }
    link(tStart + 8, tStart + 0);
    link(tStart + 12, tStart + 1);
    link(tStart + 9, tStart + 1);
  }

  return { nodes, edges, adj, neighbors };
}

// ─── Glow sprite texture ──────────────────────────────────────────────────────

function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.25, "rgba(255,255,255,0.65)");
  grad.addColorStop(0.55, "rgba(255,255,255,0.18)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

// ─── Signal slot ──────────────────────────────────────────────────────────────

const MAX_SIG = 64;

interface Sig {
  active: boolean;
  route: number[];
  hop: number;
  t: number;
  speed: number;
  color: THREE.Color;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface NeuralOrchestratorProps {
  /** Live topology — falls back to built-in HKI fixture when omitted */
  topology?: OrchestratorTopology;
  /** Visual theme — defaults to hkiTheme */
  theme?: NeuralOrchestratorTheme;
  /** When true, renders only the Three.js canvas — no stat/legend/inspector overlays.
   *  Use this when embedding the viz as a background element in a larger layout. */
  bare?: boolean;
  /** Called when user clicks a node or background (null = deselect) */
  onNodeSelect?: (nodeId: string | null) => void;
}

// ─── Role display helpers ─────────────────────────────────────────────────────

const ROLE_LABEL: Record<NodeRole, string> = {
  orchestrator: "ORCHESTRATOR",
  agent: "AGENT",
  tool: "TOOL",
  persist: "PERSISTENCE",
};

const toHex = (n: number) => "#" + n.toString(16).padStart(6, "0");

// ─── Component ────────────────────────────────────────────────────────────────

interface SelState {
  id: number;
  label: string;
  role: NodeRole;
  rel: string;
  conns: number;
}

export function NeuralOrchestrator({
  topology,
  theme = hkiTheme,
  bare = false,
  onNodeSelect,
}: NeuralOrchestratorProps = {}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const selRef = useRef<number | null>(null);

  const [selected, setSelected] = useState<SelState | null>(null);
  const [hud, setHud] = useState({ active: 0, fired: 0, tps: 0 });
  const [feed, setFeed] = useState<Array<{ t: number; line: string }>>([]);

  useEffect(() => {
    const mount = mountRef.current!;
    let W = mount.clientWidth;
    let H = mount.clientHeight || 600;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(theme.bg);
    scene.fog = new THREE.FogExp2(theme.bg, 0.0032);

    const camera = new THREE.PerspectiveCamera(55, W / H, 1, 2000);
    camera.position.set(0, 0, 210);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    mount.appendChild(renderer.domElement);

    const tex = glowTexture();
    const G = buildGraph(theme, topology);
    const world = new THREE.Group();
    scene.add(world);

    // Starfield — random, not deterministic (decorative only)
    {
      const sp = new Float32Array(900 * 3);
      for (let i = 0; i < 900; i++) {
        const th = 2 * Math.PI * Math.random();
        const ph = Math.acos(2 * Math.random() - 1);
        const r = 400 + Math.random() * 500;
        sp.set(
          [
            r * Math.sin(ph) * Math.cos(th),
            r * Math.sin(ph) * Math.sin(th),
            r * Math.cos(ph),
          ],
          i * 3
        );
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
      scene.add(
        new THREE.Points(
          sg,
          new THREE.PointsMaterial({
            color: theme.edges.base,
            size: 1.6,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.7,
          })
        )
      );
    }

    // Containment shell
    world.add(
      new THREE.Mesh(
        new THREE.IcosahedronGeometry(90, 2),
        new THREE.MeshBasicMaterial({
          color: theme.edges.base,
          wireframe: true,
          transparent: true,
          opacity: 0.14,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      )
    );

    // All edges — single LineSegments with vertex colors
    const eBase = new THREE.Color(theme.edges.base);
    const eHot = new THREE.Color(theme.edges.hot);
    const epos = new Float32Array(G.edges.length * 6);
    const ecol = new Float32Array(G.edges.length * 6);
    G.edges.forEach(([a, b], i) => {
      const pa = G.nodes[a]!.pos,
        pb = G.nodes[b]!.pos;
      epos.set([pa.x, pa.y, pa.z, pb.x, pb.y, pb.z], i * 6);
      ecol.set([eBase.r, eBase.g, eBase.b, eBase.r, eBase.g, eBase.b], i * 6);
    });
    const edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute("position", new THREE.BufferAttribute(epos, 3));
    edgeGeo.setAttribute("color", new THREE.BufferAttribute(ecol, 3));
    world.add(
      new THREE.LineSegments(
        edgeGeo,
        new THREE.LineBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      )
    );
    const edgeAct = new Float32Array(G.edges.length);

    // Nodes + halos
    const meshes: THREE.Mesh[] = [];
    const halos: THREE.Sprite[] = [];
    const nodeAct = new Float32Array(G.nodes.length);

    G.nodes.forEach(n => {
      const segs = n.role === "orchestrator" ? 32 : 18;
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(n.size, segs, segs),
        new THREE.MeshBasicMaterial({ color: n._base.clone() })
      );
      mesh.position.copy(n.pos);
      mesh.userData["nid"] = n.id;
      world.add(mesh);
      meshes.push(mesh);

      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: tex,
          color: n._base.clone(),
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          opacity: 0.55,
        })
      );
      const s = n.size * (n.role === "orchestrator" ? 5.5 : 4.2);
      halo.scale.set(s, s, s);
      halo.position.copy(n.pos);
      world.add(halo);
      halos.push(halo);
    });

    const coreWire = new THREE.Mesh(
      new THREE.IcosahedronGeometry(18, 1),
      new THREE.MeshBasicMaterial({
        color: theme.nodes.orchestrator,
        wireframe: true,
        transparent: true,
        opacity: 0.32,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    world.add(coreWire);

    const ring = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: tex,
        color: theme.edges.hot,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0,
      })
    );
    ring.scale.set(1, 1, 1);
    world.add(ring);

    // Signal particles — fixed-size buffer, slots reused
    const spos = new Float32Array(MAX_SIG * 3);
    const scol = new Float32Array(MAX_SIG * 3);
    const sigGeo = new THREE.BufferGeometry();
    sigGeo.setAttribute("position", new THREE.BufferAttribute(spos, 3));
    sigGeo.setAttribute("color", new THREE.BufferAttribute(scol, 3));
    world.add(
      new THREE.Points(
        sigGeo,
        new THREE.PointsMaterial({
          size: 6.5,
          map: tex,
          vertexColors: true,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          sizeAttenuation: true,
        })
      )
    );

    const sigs: Sig[] = Array.from({ length: MAX_SIG }, () => ({
      active: false,
      route: [],
      hop: 0,
      t: 0,
      speed: 1,
      color: new THREE.Color(),
    }));

    const stat = { fired: 0, last: 0 };
    let feedBuf: Array<{ t: number; line: string }> = [];

    const makeRoute = () => {
      const route = [0];
      let cur = 0,
        prev = -1;
      for (let h = 0; h < 2 + Math.floor(Math.random() * 4); h++) {
        const opts = (G.neighbors[cur] ?? []).filter(([nb]) => nb !== prev);
        if (!opts.length) break;
        const [nb] = opts[Math.floor(Math.random() * opts.length)]!;
        route.push(nb);
        prev = cur;
        cur = nb;
      }
      return route;
    };

    const spawn = () => {
      const s = sigs.find(x => !x.active);
      if (!s) return;
      const route = makeRoute();
      if (route.length < 2) return;
      s.active = true;
      s.route = route;
      s.hop = 0;
      s.t = 0;
      s.speed = 1.6 + Math.random() * 1.2;
      s.color.set(
        theme.signals[Math.floor(Math.random() * theme.signals.length)]!
      );
      stat.fired++;
      const names = route.map(i =>
        (G.nodes[i]?.label ?? "").replace(/·/g, "").trim()
      );
      const cy = names
        .map((nm, i) =>
          i === 0 ? `(o:Orchestrator)` : `(:${nm.replace(/\s+/g, "")})`
        )
        .join("-[r]->");
      feedBuf = [{ t: Date.now(), line: `MATCH p = ${cy}` }, ...feedBuf].slice(
        0,
        6
      );
    };

    // Pointer interaction
    const drag = { on: false, x: 0, y: 0, moved: 0 };
    const vel = { x: 0, y: -0.0016 };
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();

    const pick = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(meshes, false)[0];
      if (hit) {
        const id = hit.object.userData["nid"] as number;
        const n = G.nodes[id]!;
        selRef.current = id;
        setSelected({
          id,
          label: n.label,
          role: n.role,
          rel: n.rel,
          conns: G.neighbors[id]!.length,
        });
        onNodeSelect?.(n.key);
      } else {
        selRef.current = null;
        setSelected(null);
        onNodeSelect?.(null);
      }
    };

    const onDown = (e: PointerEvent) => {
      drag.on = true;
      drag.moved = 0;
      drag.x = e.clientX;
      drag.y = e.clientY;
    };
    const onMove = (e: PointerEvent) => {
      if (!drag.on) return;
      const dx = e.clientX - drag.x,
        dy = e.clientY - drag.y;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      vel.x = dy * 0.00035;
      vel.y = dx * 0.00035;
      world.rotation.y += dx * 0.005;
      world.rotation.x = Math.max(
        -1.2,
        Math.min(1.2, world.rotation.x + dy * 0.005)
      );
      drag.x = e.clientX;
      drag.y = e.clientY;
    };
    const onUp = (e: PointerEvent) => {
      if (drag.on && drag.moved < 6) pick(e);
      drag.on = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camera.position.z = Math.max(
        95,
        Math.min(330, camera.position.z + e.deltaY * 0.12)
      );
    };

    const el = renderer.domElement;
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });

    // Render loop
    const clock = new THREE.Clock();
    let raf: number;
    let spawnAcc = 0;
    let hudAcc = 0;
    const tmp = new THREE.Vector3();
    const ecolAttr = edgeGeo.attributes["color"] as THREE.BufferAttribute;
    const sposAttr = sigGeo.attributes["position"] as THREE.BufferAttribute;
    const scolAttr = sigGeo.attributes["color"] as THREE.BufferAttribute;

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, clock.getDelta());

      world.rotation.y += vel.y;
      world.rotation.x = Math.max(
        -1.2,
        Math.min(1.2, world.rotation.x + vel.x)
      );
      if (!drag.on) {
        vel.x *= 0.94;
        vel.y = vel.y * 0.96 - 0.0016 * 0.04;
        if (Math.abs(vel.y) < 0.0016) vel.y = -0.0016;
      }
      coreWire.rotation.y += 0.004;
      coreWire.rotation.x += 0.0021;

      spawnAcc += dt;
      if (spawnAcc > 0.45) {
        spawnAcc = 0;
        spawn();
        if (Math.random() < 0.4) spawn();
      }

      let alive = 0;
      for (let i = 0; i < MAX_SIG; i++) {
        const s = sigs[i]!;
        if (!s.active) {
          scol[i * 3] = scol[i * 3 + 1] = scol[i * 3 + 2] = 0;
          continue;
        }
        alive++;
        s.t += dt * s.speed;
        const a = s.route[s.hop]!,
          b = s.route[s.hop + 1]!;
        const pa = G.nodes[a]!.pos,
          pb = G.nodes[b]!.pos;
        const k = a < b ? `${a}-${b}` : `${b}-${a}`;
        const ei = G.adj.get(k);
        if (ei !== undefined)
          edgeAct[ei] = Math.min(1, edgeAct[ei]! + dt * 3 * s.speed);
        if (s.t >= 1) {
          nodeAct[b] = 1;
          s.hop++;
          s.t = 0;
          if (s.hop >= s.route.length - 1) {
            s.active = false;
            continue;
          }
        }
        tmp.copy(pa).lerp(pb, Math.min(1, s.t));
        spos[i * 3] = tmp.x;
        spos[i * 3 + 1] = tmp.y;
        spos[i * 3 + 2] = tmp.z;
        scol[i * 3] = s.color.r;
        scol[i * 3 + 1] = s.color.g;
        scol[i * 3 + 2] = s.color.b;
      }
      sposAttr.needsUpdate = true;
      scolAttr.needsUpdate = true;

      for (let i = 0; i < G.edges.length; i++) {
        edgeAct[i]! *= 1 - dt * 0.9;
        const f = edgeAct[i]!;
        const r = eBase.r + (eHot.r - eBase.r) * f;
        const g = eBase.g + (eHot.g - eBase.g) * f;
        const bl = eBase.b + (eHot.b - eBase.b) * f;
        ecol[i * 6] = r;
        ecol[i * 6 + 1] = g;
        ecol[i * 6 + 2] = bl;
        ecol[i * 6 + 3] = r;
        ecol[i * 6 + 4] = g;
        ecol[i * 6 + 5] = bl;
      }
      ecolAttr.needsUpdate = true;

      const t = clock.elapsedTime;
      for (let i = 0; i < G.nodes.length; i++) {
        nodeAct[i]! *= 1 - dt * 1.6;
        const n = G.nodes[i]!,
          act = nodeAct[i]!;
        (meshes[i]!.material as THREE.MeshBasicMaterial).color
          .copy(n._base)
          .lerp(n._hot, act);
        const pulse =
          n.role === "orchestrator"
            ? 0.5 + 0.5 * Math.sin(t * 2.0)
            : 0.15 * Math.sin(t * 1.5 + i);
        const base = n.role === "orchestrator" ? 0.45 : 0.4;
        halos[i]!.material.opacity = Math.min(
          1,
          base + act * 0.6 + pulse * 0.25
        );
        const sc =
          n.size *
          (n.role === "orchestrator" ? 5.5 : 4.2) *
          (1 + act * 0.5 + (n.role === "orchestrator" ? pulse * 0.18 : 0));
        halos[i]!.scale.set(sc, sc, sc);
      }

      const sel = selRef.current;
      if (sel !== null) {
        const n = G.nodes[sel]!;
        ring.position.copy(n.pos);
        const rs = n.size * 7;
        ring.scale.set(rs, rs, rs);
        ring.material.opacity = 0.35 + 0.15 * Math.sin(t * 4);
        nodeAct[sel] = Math.max(nodeAct[sel]!, 0.6);
      } else {
        ring.material.opacity *= 0.85;
      }

      // Throttled HUD flush — ≤5 React state updates per second
      hudAcc += dt;
      if (hudAcc > 0.2) {
        const tps = Math.round((stat.fired - stat.last) / hudAcc);
        stat.last = stat.fired;
        hudAcc = 0;
        setHud({ active: alive, fired: stat.fired, tps });
        setFeed([...feedBuf]);
      }

      renderer.render(scene, camera);
    };
    frame();

    const ro = new ResizeObserver(() => {
      W = mount.clientWidth;
      H = mount.clientHeight || 600;
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      renderer.setSize(W, H);
    });
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      el.removeEventListener("wheel", onWheel);
      scene.traverse(obj => {
        const m = obj as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material)
          (Array.isArray(m.material) ? m.material : [m.material]).forEach(x =>
            x.dispose()
          );
      });
      tex.dispose();
      renderer.dispose();
      renderer.domElement.parentNode?.removeChild(renderer.domElement);
    };
  }, [theme, topology, onNodeSelect]);

  // ── Overlay ── all colors via CSS custom properties (fallbacks = HKI dark) ──

  const roleColor = (role: NodeRole) => toHex(theme.nodes[role]);

  return (
    <div style={css.root}>
      <div ref={mountRef} style={css.canvas} />

      {bare ? null : (
        <>
          <header style={css.header}>
            <div style={css.title}>◉ NEURAL · ORCHESTRATOR</div>
            <div style={css.subtitle}>
              live agentic pathway projection · topology persisted in Neo4j
            </div>
          </header>

          <div style={css.statsRow}>
            <StatCard
              label="SIGNALS LIVE"
              value={hud.active}
              accent={roleColor("agent")}
            />
            <StatCard
              label="PATHS FIRED"
              value={hud.fired}
              accent={roleColor("orchestrator")}
            />
            <StatCard
              label="FIRE RATE"
              value={`${hud.tps}/s`}
              accent={roleColor("persist")}
            />
          </div>

          <div style={css.legend}>
            {(["orchestrator", "agent", "tool", "persist"] as NodeRole[]).map(
              role => (
                <div key={role} style={css.legendItem}>
                  <span
                    style={{
                      ...css.dot,
                      background: roleColor(role),
                      boxShadow: `0 0 7px ${roleColor(role)}`,
                    }}
                  />
                  <span style={css.legendLabel}>{ROLE_LABEL[role]}</span>
                </div>
              )
            )}
            <div style={css.hint}>
              drag · rotate &nbsp;&nbsp; scroll · zoom &nbsp;&nbsp; click ·
              inspect
            </div>
          </div>

          <div
            style={css.feed}
            aria-live="polite"
            aria-label="Live Cypher query feed"
          >
            {feed.map((f, i) => (
              <div
                key={`${f.t}-${i}`}
                style={{ ...css.feedLine, opacity: 1 - i * 0.15 }}
              >
                {f.line}
              </div>
            ))}
          </div>

          {selected && (
            <div
              style={{
                ...css.panel,
                borderColor: roleColor(selected.role) + "50",
              }}
            >
              <div style={{ ...css.roleTag, color: roleColor(selected.role) }}>
                {ROLE_LABEL[selected.role]}
              </div>
              <div style={css.panelTitle}>{selected.label}</div>
              <div style={css.divider} />
              <PRow
                label="neo4j label"
                value={`:${selected.label.replace(/[\s·]/g, "")}`}
              />
              <PRow
                label="relationship"
                value={`-[:${selected.rel}]→`}
                accent={roleColor(selected.role)}
              />
              <PRow label="connections" value={`${selected.conns} synapses`} />
              <PRow
                label="status"
                value="LIVE · firing"
                accent="var(--primary, #1fa9a5)"
              />
              <div style={css.divider} />
              <pre
                style={css.cypher}
              >{`MATCH (n:${selected.label.replace(/[\s·]/g, "")})-[r]-(m)\nRETURN n,r,m LIMIT 25`}</pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Overlay sub-components ───────────────────────────────────────────────────

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div style={css.statCard}>
      <span style={css.statLabel}>{label}</span>
      <span style={{ ...css.statValue, color: accent }}>{value}</span>
    </div>
  );
}

function PRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div style={css.pRow}>
      <span style={css.pLabel}>{label}</span>
      <span style={{ ...css.pValue, ...(accent ? { color: accent } : {}) }}>
        {value}
      </span>
    </div>
  );
}

// ─── Styles — CSS custom property–driven ─────────────────────────────────────
// Every color references a CSS var with a fallback that matches HKI dark theme.
// This makes the component work in any consuming app as long as @hki/ui tokens
// are imported, AND works in isolation without any token import.

const MONO = `"JetBrains Mono","IBM Plex Mono",ui-monospace,monospace`;
const DISP = `"Plus Jakarta Sans","Chakra Petch",system-ui,sans-serif`;

const GLASS: React.CSSProperties = {
  background: "var(--card, #18181b)",
  border: "1px solid var(--border, #27272a)",
  borderRadius: 12,
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
};

const css: Record<string, React.CSSProperties> = {
  root: {
    position: "relative",
    width: "100%",
    height: "100%",
    minHeight: 560,
    overflow: "hidden",
    background: "var(--background, #000000)",
    fontFamily: MONO,
    userSelect: "none",
    color: "var(--foreground, #f4f4f5)",
  },
  canvas: { position: "absolute", inset: 0, cursor: "grab" },
  header: { position: "absolute", top: 18, left: 22, pointerEvents: "none" },
  title: {
    fontFamily: DISP,
    fontWeight: 700,
    fontSize: 18,
    letterSpacing: ".18em",
    color: "var(--foreground, #f4f4f5)",
  },
  subtitle: {
    fontSize: 9.5,
    letterSpacing: ".12em",
    marginTop: 3,
    color: "var(--muted-foreground, #71717a)",
  },
  statsRow: {
    position: "absolute",
    top: 16,
    right: 22,
    display: "flex",
    gap: 8,
  },
  statCard: {
    ...GLASS,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    padding: "7px 12px",
    gap: 2,
  },
  statLabel: {
    fontSize: 7.5,
    letterSpacing: ".2em",
    color: "var(--muted-foreground, #71717a)",
  },
  statValue: { fontFamily: DISP, fontSize: 17, fontWeight: 700 },
  legend: {
    position: "absolute",
    left: 22,
    bottom: 22,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    pointerEvents: "none",
  },
  legendItem: { display: "flex", alignItems: "center", gap: 8 },
  dot: {
    width: 9,
    height: 9,
    borderRadius: "50%",
    display: "inline-block" as const,
    flexShrink: 0,
  },
  legendLabel: {
    fontSize: 9.5,
    letterSpacing: ".1em",
    color: "var(--muted-foreground, #71717a)",
  },
  hint: {
    marginTop: 4,
    fontSize: 9,
    letterSpacing: ".1em",
    color: "var(--muted-foreground, #52525b)",
    opacity: 0.7,
  },
  feed: {
    position: "absolute",
    right: 22,
    bottom: 22,
    width: 380,
    textAlign: "right",
    fontSize: 10,
    lineHeight: 1.9,
    pointerEvents: "none",
    overflow: "hidden",
    color: "var(--primary, #1fa9a5)",
  },
  feedLine: {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  panel: {
    ...GLASS,
    position: "absolute",
    left: 22,
    top: 90,
    width: 276,
    padding: "16px 18px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
  },
  roleTag: { fontSize: 9, letterSpacing: ".22em", marginBottom: 4 },
  panelTitle: {
    fontFamily: DISP,
    fontWeight: 700,
    fontSize: 20,
    letterSpacing: ".02em",
    color: "var(--foreground, #f4f4f5)",
    marginBottom: 10,
  },
  divider: {
    height: 1,
    background: "var(--border, #27272a)",
    margin: "10px 0",
  },
  pRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 11.5,
    padding: "2.5px 0",
    gap: 8,
  },
  pLabel: { color: "var(--muted-foreground, #71717a)", flexShrink: 0 },
  pValue: {
    color: "var(--foreground, #f4f4f5)",
    textAlign: "right",
    wordBreak: "break-word",
  },
  cypher: {
    margin: 0,
    fontSize: 9.5,
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
    fontFamily: MONO,
    color: "var(--primary, #1fa9a5)",
    background: "color-mix(in srgb, var(--primary, #1fa9a5) 10%, transparent)",
    border:
      "1px solid color-mix(in srgb, var(--primary, #1fa9a5) 25%, transparent)",
    borderRadius: 7,
    padding: "8px 10px",
  },
};
