import { useState } from "react";
import {
  NeuralOrchestrator,
  myelinTheme,
  hkiTheme,
  neuralTheme,
  createThemeFromPrimaryToken,
} from "@myelin/react";
import type { NeuralOrchestratorTheme } from "@myelin/react";
import {
  Badge,
  Card,
  CardContent,
  Separator,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  cn,
} from "@hki/ui";
import { CodeBlock } from "../components/CodeBlock.js";
import { m } from "../theme.js";

// ─── Theme catalog ────────────────────────────────────────────────────────────

interface ThemeMeta {
  id: string;
  name: string;
  sub: string;
  desc: string;
  hint: string;
  theme: NeuralOrchestratorTheme;
  // Visualization palette data — acceptable as inline styles
  swatches: Array<{ role: string; hex: string; label: string }>;
  code: string;
}

const toHex = (n: number) => "#" + n.toString(16).padStart(6, "0");
const swatchesFromTheme = (theme: NeuralOrchestratorTheme) => [
  {
    role: "Orchestrator",
    hex: toHex(theme.nodes.orchestrator),
    label: "derived from primary token",
  },
  {
    role: "Agent",
    hex: toHex(theme.nodes.agent),
    label: "derived via tint transform",
  },
  {
    role: "Tool",
    hex: toHex(theme.nodes.tool),
    label: "derived via shade transform",
  },
  {
    role: "Persist",
    hex: toHex(theme.nodes.persist),
    label: "derived via tint transform",
  },
];

const CATALOG: ThemeMeta[] = [
  {
    id: "myelin",
    name: "Myelin Theme",
    sub: "Engine preset · same HKI shell primitives",
    desc: "Myelin's own visualization preset. It is derived from one primary token and intended for the standalone engine, docs, and demos.",
    hint: "Default for the Myelin showcase. The surrounding UI still uses @hki/ui agentic primitives; only the semantic primary token and visualization palette are Myelin-specific.",
    theme: myelinTheme,
    swatches: swatchesFromTheme(myelinTheme),
    code: `import { NeuralOrchestrator, myelinTheme } from '@myelin/react'

export function MyelinEnginePanel() {
  return (
    <NeuralOrchestrator theme={myelinTheme} />
  )
}`,
  },
  {
    id: "hki",
    name: "HKI Host Theme",
    sub: "Host-aligned · apps/agentic primary token",
    desc: "Derived from one primary token (HKI Iris). Myelin generates all role/edge/signal colors from that single identity color.",
    hint: "Default for apps/agentic. The orchestrator page reads --primary and builds the full Myelin theme from it.",
    theme: hkiTheme,
    swatches: swatchesFromTheme(hkiTheme),
    code: `import { NeuralOrchestrator, createThemeFromPrimaryToken } from '@myelin/react'

const theme = createThemeFromPrimaryToken({ primary: 0x1fa9a5 })

export function OrchestratorPanel() {
  return (
    <NeuralOrchestrator theme={theme} />
  )
}`,
  },
  {
    id: "neural",
    name: "Neural Theme",
    sub: "Sci-fi dark · maximised glow",
    desc: "A deep-space aesthetic that amplifies Three.js additive blending. Near-white orchestrators, cyan agents, amber tools, lime-green persistence.",
    hint: "Best on full-screen canvases with no surrounding UI. Signal colours dominate.",
    theme: neuralTheme,
    swatches: swatchesFromTheme(neuralTheme),
    code: `import { NeuralOrchestrator, neuralTheme } from '@myelin/react'

export function FullScreenViz() {
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <NeuralOrchestrator theme={neuralTheme} />
    </div>
  )
}`,
  },
];

const INTERFACE_CODE = `interface NeuralOrchestratorTheme {
  bg: number
  nodes: {
    orchestrator: number
    agent:        number
    tool:         number
    persist:      number
  }
  edges: {
    base: number  // resting colour
    hot:  number  // active (signal travelling)
  }
  signals: readonly [number, number, number, number, number]
}`;

const CUSTOM_CODE = `import { createThemeFromPrimaryToken } from '@myelin/react'

export const myTheme = createThemeFromPrimaryToken({
  primary: 0x38bdf8,
  bg: 0x030510,
})`;

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ThemesPage() {
  const [activeId, setActiveId] = useState("myelin");
  const active = CATALOG.find(t => t.id === activeId)!;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-10">
      {/* ── Header ────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <h1 className={cn(m.display, "text-2xl")}>Theme system</h1>
        <p className={cn(m.subtext, "max-w-xl")}>
          Swap the full visual identity with a single prop. All colors live in{" "}
          <code
            className={cn(
              m.mono,
              "text-primary bg-primary/10 px-1 py-0.5 rounded"
            )}
          >
            NeuralOrchestratorTheme
          </code>{" "}
          — fully typed, fully extensible.
        </p>
      </section>

      <Separator />

      {/* ── Theme switcher + live preview ─────────────────────────── */}
      <section className="space-y-4">
        <p className={m.label}>Built-in themes</p>

        <Tabs value={activeId} onValueChange={setActiveId}>
          <TabsList className="mb-6">
            {CATALOG.map(t => (
              <TabsTrigger key={t.id} value={t.id}>
                {t.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {CATALOG.map(t => (
            <TabsContent key={t.id} value={t.id}>
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 items-start">
                {/* Live viz */}
                <div
                  className={cn(
                    m.card,
                    "relative overflow-hidden rounded-xl border border-border/70"
                  )}
                  style={{ height: 380 }}
                >
                  <NeuralOrchestrator theme={t.theme} bare />
                </div>

                {/* Info panel */}
                <div className="flex flex-col gap-3">
                  <div
                    className={cn(
                      m.card,
                      "rounded-xl border border-border/70 px-4 py-4"
                    )}
                  >
                    <p
                      className={cn(
                        m.mono,
                        "uppercase tracking-widest text-[9px] mb-1.5"
                      )}
                    >
                      {t.sub}
                    </p>
                    <p className={m.heading}>{t.name}</p>
                    <p className={cn(m.muted, "mt-1.5 leading-relaxed")}>
                      {t.desc}
                    </p>
                  </div>

                  {/* Swatches — colors are Three.js viz data */}
                  <div
                    className={cn(
                      m.card,
                      "rounded-xl border border-border/70 px-4 py-4 space-y-3"
                    )}
                  >
                    <p className={cn(m.label, "mb-1")}>Node colors</p>
                    {t.swatches.map(s => (
                      <div key={s.role} className="flex items-center gap-3">
                        <div
                          className="w-6 h-6 rounded-lg shrink-0"
                          style={{
                            background: s.hex,
                            boxShadow: `0 0 8px ${s.hex}55`,
                          }}
                        />
                        <div>
                          <p
                            className={cn(
                              m.mono,
                              "text-foreground font-semibold text-xs"
                            )}
                          >
                            {s.role}
                          </p>
                          <p className={m.mono}>
                            {s.label} · {s.hex}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div
                    className={cn(
                      m.inset,
                      "rounded-xl border border-primary/15 px-4 py-3"
                    )}
                  >
                    <p
                      className={cn(
                        m.mono,
                        "text-primary uppercase tracking-widest text-[9px] mb-1.5"
                      )}
                    >
                      Usage note
                    </p>
                    <p className={m.muted}>{t.hint}</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                <p className={m.label}>Usage — {t.name}</p>
                <CodeBlock code={t.code} language="tsx" />
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </section>

      <Separator />

      {/* ── Custom theme ──────────────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <p className={m.label}>Custom themes</p>
          <p className={cn(m.heading, "mt-1 text-base")}>
            Build your own palette
          </p>
          <p className={cn(m.subtext, "mt-1.5 max-w-lg")}>
            The{" "}
            <code
              className={cn(
                m.mono,
                "text-primary bg-primary/10 px-1 py-0.5 rounded"
              )}
            >
              NeuralOrchestratorTheme
            </code>{" "}
            interface is fully exported. All colors are{" "}
            <code
              className={cn(
                m.mono,
                "text-primary bg-primary/10 px-1 py-0.5 rounded"
              )}
            >
              0x
            </code>{" "}
            hex integers, consistent with the Three.js color API.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className={m.label}>Interface</p>
            <CodeBlock language="typescript" code={INTERFACE_CODE} />
          </div>
          <div className="space-y-2">
            <p className={m.label}>Example</p>
            <CodeBlock language="typescript" code={CUSTOM_CODE} />
          </div>
        </div>
      </section>

      <Separator />

      {/* ── Invariant ─────────────────────────────────────────────── */}
      <section className="pb-10">
        <div
          className={cn(
            m.inset,
            "flex items-start gap-4 rounded-xl border border-primary/15 px-5 py-5"
          )}
        >
          <Badge variant="default" className="shrink-0 mt-0.5">
            Invariant
          </Badge>
          <div className="space-y-1">
            <p className={m.heading}>
              Theme colors must come from the theme object
            </p>
            <p className={m.muted}>
              Never hardcode hex values inside component logic. Always read{" "}
              <code
                className={cn(
                  m.mono,
                  "text-primary bg-primary/10 px-1 rounded"
                )}
              >
                theme.nodes[role]
              </code>
              ,{" "}
              <code
                className={cn(
                  m.mono,
                  "text-primary bg-primary/10 px-1 rounded"
                )}
              >
                theme.edges.hot
              </code>
              , and{" "}
              <code
                className={cn(
                  m.mono,
                  "text-primary bg-primary/10 px-1 rounded"
                )}
              >
                theme.signals[i]
              </code>
              . Panels use{" "}
              <code
                className={cn(
                  m.mono,
                  "text-primary bg-primary/10 px-1 rounded"
                )}
              >
                var(--card)
              </code>{" "}
              and{" "}
              <code
                className={cn(
                  m.mono,
                  "text-primary bg-primary/10 px-1 rounded"
                )}
              >
                var(--border)
              </code>
              .
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
