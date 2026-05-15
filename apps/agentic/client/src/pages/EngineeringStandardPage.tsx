import { useCallback, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { ArrowRight, GitBranch } from "lucide-react";
import { cn, hub } from "@hki/ui";

import { usePageMeta } from "@/hooks/usePageMeta";
import {
  ENGINEERING_HUB_ROUTE,
  HKI_ARCHITECTURE_ROUTE,
  HKI_STANDARD_ROUTE,
} from "@/pages/engineering/constants";

import { EngineeringHeader } from "@/pages/engineering/components/EngineeringHeader";
import { SectionLede } from "@/pages/engineering/components/SectionLede";
import { RiskCard } from "@/pages/engineering/components/RiskCard";
import { AutonomyLadder } from "@/pages/engineering/components/AutonomyLadder";
import { RuntimeContractDiagram } from "@/pages/engineering/components/RuntimeContractDiagram";
import { DocumentOutline } from "@/pages/engineering/components/DocumentOutline";
import { ArticleMarkdown } from "@/pages/engineering/components/ArticleMarkdown";
import { ReadingProgress } from "@/pages/engineering/components/ReadingProgress";
import {
  ProseBlock,
  WideBlock,
} from "@/pages/engineering/components/WideSection";
import { PublicationMasthead } from "@/pages/engineering/components/PublicationMasthead";
import { NumberedSection } from "@/pages/engineering/components/NumberedSection";
import { PullQuote } from "@/pages/engineering/components/PullQuote";
import { EndMatter } from "@/pages/engineering/components/EndMatter";
import {
  useActiveHeading,
  useDocumentOutline,
} from "@/pages/engineering/components/useDocumentOutline";
import { stripDuplicateSections } from "@/pages/engineering/markdown/stripDuplicateSections";
import { RISK_SCENARIOS } from "@/pages/engineering/data/riskScenarios";

import hkiPaperRaw from "../../../../../docs/HKI-package/HERMETIC-KNOWLEDGE-ISOLATION.md?raw";
import hkiStoryUrl from "../../../../../docs/HKI-package/images/hki/06-hki-story.svg";
import runtimePlaneUrl from "../../../../../docs/HKI-package/images/hki/01-runtime-vs-admin-plane.svg";
import requestFlowUrl from "../../../../../docs/HKI-package/images/hki/02-request-flow.svg";
import publicationFanoutUrl from "../../../../../docs/HKI-package/images/hki/03-publication-fanout.svg";
import leakPathsUrl from "../../../../../docs/HKI-package/images/hki/04-leak-paths-blocked.svg";
import migrationRoadmapUrl from "../../../../../docs/HKI-package/images/hki/05-migration-roadmap.svg";

const IMAGE_URLS: Record<string, string> = {
  "images/hki/01-runtime-vs-admin-plane.svg": runtimePlaneUrl,
  "images/hki/02-request-flow.svg": requestFlowUrl,
  "images/hki/03-publication-fanout.svg": publicationFanoutUrl,
  "images/hki/04-leak-paths-blocked.svg": leakPathsUrl,
  "images/hki/05-migration-roadmap.svg": migrationRoadmapUrl,
  "images/hki/06-hki-story.svg": hkiStoryUrl,
};

const HKI_PAPER = stripDuplicateSections(hkiPaperRaw);
const READING_TIME_MIN = Math.max(
  1,
  Math.ceil(HKI_PAPER.split(/\s+/).filter(Boolean).length / 220)
);
const SECTION_COUNT = (HKI_PAPER.match(/^##\s+/gm) ?? []).length;

const PRINTABLE_BRIEF_HREF =
  "https://github.com/innovationlab/Hki/blob/main/docs/HKI-package/HKI-EXECUTIVE-BRIEF.md";
const SOURCE_HREF =
  "https://github.com/innovationlab/Hki/tree/main/docs/HKI-package";

const CITATION_BIBTEX = `@techreport{ghebrechristos2026hki,
  title  = {Hermetic Knowledge Isolation: A Runtime Contract
            for Enterprise Agentic Systems},
  author = {Ghebrechristos, Henok},
  year   = {2026},
  type   = {HKI Standard},
  number = {HKI-1.0},
  url    = {https://github.com/innovationlab/Hki}
}`;

const VERSION_HISTORY = [
  {
    version: "v1.0",
    date: "2026-04-22",
    note: "Initial public standard. Six invariants, three planes, conformance L4-deployed.",
  },
  {
    version: "v0.9",
    date: "2026-03-08",
    note: "Pre-release. Threat catalog T01–T15, six adapter packages.",
  },
  {
    version: "v0.5",
    date: "2026-01-14",
    note: "Internal review. Runtime contract diagram and publication plane formalized.",
  },
] as const;

type Navigate = (path: string) => void;

function ArchitectureLaunchPanel({ onNavigate }: { onNavigate: Navigate }) {
  return (
    <div className="border-y border-border bg-muted/30 py-6">
      <div className="grid gap-7 px-1 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-center">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
            Architecture workspace
          </p>
          <h3 className="mt-3 max-w-3xl text-2xl font-bold tracking-tight text-foreground">
            Open the reference architecture as a separate working surface.
          </h3>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-muted-foreground">
            The diagram needs the whole viewport: a left path menu, readable
            zoom, selected-node details, minimap, pan controls, and copyable
            enforcement notes. The paper stays narrative; the workspace handles
            inspection.
          </p>
          <a
            href={HKI_ARCHITECTURE_ROUTE}
            onClick={event => {
              event.preventDefault();
              onNavigate(HKI_ARCHITECTURE_ROUTE);
            }}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/20 transition-all hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/30 active:translate-y-0"
          >
            Open Architecture Workspace
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        <ul className="grid gap-3 border-t border-border pt-5 text-sm lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          {[
            [
              "Runtime path",
              "Envelope travels through retrieval, cache, graph, tools, jobs, and response.",
            ],
            [
              "Publication path",
              "Cross-domain sharing appears only as audited, materialized copies.",
            ],
            [
              "Admin path",
              "Cross-domain views stay on a separate plane, unreachable from runtime routes.",
            ],
          ].map(([label, detail]) => (
            <li key={label} className="flex gap-3">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
              <span>
                <span className="block font-bold text-foreground">{label}</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {detail}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function EngineeringStandardPage() {
  usePageMeta("HKI Standard · Architecture");
  const [, setLocation] = useLocation();

  const navigate = useCallback(
    (path: string) => {
      setLocation(path);
      const hash = path.split("#")[1];
      if (!hash) return;
      window.setTimeout(() => {
        document
          .getElementById(decodeURIComponent(hash))
          ?.scrollIntoView({ block: "start" });
      }, 0);
    },
    [setLocation]
  );

  const articleRef = useRef<HTMLElement>(null);
  const outline = useDocumentOutline(articleRef, [HKI_PAPER]);
  const headingIds = useMemo(() => outline.map(n => n.id), [outline]);
  const activeId = useActiveHeading(headingIds);

  return (
    <div className={cn(hub.page, "bg-background")}>
      <ReadingProgress trackRef={articleRef} />
      <EngineeringHeader />

      <main
        className={cn(
          hub.pageInner,
          "relative z-10 mx-auto w-full max-w-7xl px-5 pt-7 pb-12 sm:px-8"
        )}
      >
        <div className="grid gap-10 xl:grid-cols-[220px_minmax(0,1fr)]">
          <DocumentOutline nodes={outline} activeId={activeId} />

          <article
            ref={articleRef}
            className="mx-auto min-w-0 w-full"
            aria-labelledby="hki-article-title"
          >
            <PublicationMasthead
              eyebrow="HKI 1.0 · The Hermetic Knowledge Isolation Standard"
              title="Hermetic Knowledge Isolation"
              abstract="A runtime contract for enterprise agentic systems. Every artifact belongs to one domain. Every request runs in one active domain. Shared knowledge appears only through explicit publication — never silent global fallback."
              authors="Henok Ghebrechristos, PhD"
              publishedOn="22 April 2026"
              readingMinutes={READING_TIME_MIN}
              version="v1.0"
              beginHref={`${HKI_STANDARD_ROUTE}#executive-brief`}
              onBegin={navigate}
            />

            {/* 01 · Executive Brief */}
            <ProseBlock
              as="section"
              aria-labelledby="executive-brief"
              className="mt-24"
            >
              <NumberedSection
                id="executive-brief"
                number="01"
                eyebrow="Executive Brief"
                title="Autonomy changes the threat model."
                lede="Once agents rewrite, remember, retrieve, call tools, and start jobs, isolation stops being a database filter — it becomes the execution boundary that keeps autonomy from becoming cross-domain action."
              >
                <div className="space-y-5">
                  {RISK_SCENARIOS.map((s, i) => (
                    <RiskCard key={s.id} scenario={s} index={i} />
                  ))}
                </div>

                <PullQuote attribution="The HKI thesis">
                  Knowledge isolation is not a database concern. It is the shape
                  of the runtime that agents act inside.
                </PullQuote>

                <div className="mt-4">
                  <SectionLede
                    id="autonomy-ladder"
                    eyebrow="Why a primitive, not a filter"
                    title="Autonomy and isolation move together."
                    takeaway="The more an agent can do, the less safe it is to treat scope as a hint. Each stage adds capability — and the isolation requirement that has to ship with it."
                  />
                  <div className="mt-6">
                    <AutonomyLadder />
                  </div>
                </div>
              </NumberedSection>
            </ProseBlock>

            {/* 02 · Runtime Contract */}
            <section aria-labelledby="runtime-contract" className="mt-28">
              <ProseBlock>
                <NumberedSection
                  id="runtime-contract"
                  number="02"
                  eyebrow="System Model · Interactive"
                  title="One signed envelope, every step."
                  lede="The active domain is decided once at the gateway and travels — never gets re-derived — through retrieval, cache, graph, tools, and jobs. Click any stage below to see what happens there and the boundary HKI enforces."
                />
              </ProseBlock>
              <WideBlock className="mt-10">
                <RuntimeContractDiagram />
              </WideBlock>
            </section>

            {/* 03 · Reference Architecture */}
            <section aria-labelledby="reference-architecture" className="mt-28">
              <ProseBlock>
                <NumberedSection
                  id="reference-architecture"
                  number="03"
                  eyebrow="Reference Architecture"
                  title="Three planes. One contract. No silent bridges."
                  lede="The runtime plane carries one active domain end-to-end. The publication plane is the only authorized cross-domain bridge — an explicit fan-out, never a fallback. The admin plane stays unreachable from runtime endpoints."
                />
              </ProseBlock>
              <WideBlock className="mt-10">
                <ArchitectureLaunchPanel onNavigate={navigate} />
              </WideBlock>
            </section>

            {/* 04 · Full Standard */}
            <section aria-labelledby="full-standard" className="mt-28">
              <ProseBlock>
                <NumberedSection
                  id="full-standard"
                  number="04"
                  eyebrow="The Full Standard"
                  title="The complete contract."
                  lede={`What follows is the canonical HKI specification: system model, reference architecture, implementation surface, conformance tests, and migration path. ${SECTION_COUNT} sections, ~${READING_TIME_MIN} minute read.`}
                />
              </ProseBlock>

              <ProseBlock className="mt-12">
                <ArticleMarkdown source={HKI_PAPER} imageUrls={IMAGE_URLS} />
              </ProseBlock>
            </section>

            <ProseBlock>
              <EndMatter
                citation={CITATION_BIBTEX}
                versions={VERSION_HISTORY}
                evidence={[
                  { label: "Conformance level", value: "L4-deployed" },
                  { label: "Cases", value: "28 / 28 passing" },
                  { label: "HTTP probes", value: "10 / 10 passing" },
                  { label: "Registry", value: "conformance.json" },
                ]}
                printableHref={PRINTABLE_BRIEF_HREF}
                sourceHref={SOURCE_HREF}
                hubHref={ENGINEERING_HUB_ROUTE}
                onNavigateHub={() => navigate(ENGINEERING_HUB_ROUTE)}
              />
            </ProseBlock>
          </article>

        </div>
      </main>
    </div>
  );
}
