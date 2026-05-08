import { useCallback, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Clock, Moon, Sun } from "lucide-react";
import { HkiMark, Topbar, cn, hub } from "@hki/ui";

import { usePageMeta } from "@/hooks/usePageMeta";
import { useTheme } from "@/contexts/ThemeContext";
import {
  ENGINEERING_HUB_ROUTE,
  HKI_STANDARD_ROUTE,
} from "@/pages/engineering/constants";

import { Breadcrumb } from "@/pages/engineering/components/Breadcrumb";
import { ContractPills } from "@/pages/engineering/components/ContractPills";
import { SectionLede } from "@/pages/engineering/components/SectionLede";
import { RiskCard } from "@/pages/engineering/components/RiskCard";
import { AutonomyLadder } from "@/pages/engineering/components/AutonomyLadder";
import { RuntimeContractDiagram } from "@/pages/engineering/components/RuntimeContractDiagram";
import { DocumentOutline } from "@/pages/engineering/components/DocumentOutline";
import { OnThisPage } from "@/pages/engineering/components/OnThisPage";
import { ArticleFooter } from "@/pages/engineering/components/ArticleFooter";
import { ArticleMarkdown } from "@/pages/engineering/components/ArticleMarkdown";
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

const PRINTABLE_BRIEF_HREF =
  "https://github.com/innovationlab/Hki/blob/main/docs/HKI-package/HKI-EXECUTIVE-BRIEF.md";
const SOURCE_HREF =
  "https://github.com/innovationlab/Hki/tree/main/docs/HKI-package";

export default function EngineeringStandardPage() {
  usePageMeta("HKI Standard · Architecture");
  const [, setLocation] = useLocation();
  const { theme, toggleTheme } = useTheme();

  const navigate = useCallback(
    (path: string) => setLocation(path),
    [setLocation]
  );

  const articleRef = useRef<HTMLElement>(null);
  const outline = useDocumentOutline(articleRef, [HKI_PAPER]);
  const headingIds = useMemo(() => outline.map(n => n.id), [outline]);
  const activeId = useActiveHeading(headingIds);

  return (
    <div className={cn(hub.page, "bg-background")}>
      <Topbar
        variant="blur"
        showMenuTrigger={false}
        className="border-b border-border/50! bg-background! shadow-none!"
        leftContent={
          <div className="flex items-center gap-4">
            <a
              href={ENGINEERING_HUB_ROUTE}
              onClick={e => {
                e.preventDefault();
                navigate(ENGINEERING_HUB_ROUTE);
              }}
              className="flex shrink-0 items-center transition-opacity hover:opacity-80"
              aria-label="Engineering hub"
            >
              <HkiMark size={26} variant="color" />
            </a>
            <Breadcrumb
              trail={[
                {
                  label: "Hub",
                  href: ENGINEERING_HUB_ROUTE,
                  onNavigate: () => navigate(ENGINEERING_HUB_ROUTE),
                },
                { label: "HKI Standard", href: HKI_STANDARD_ROUTE },
              ]}
            />
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(ENGINEERING_HUB_ROUTE)}
              className="hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground sm:inline-flex"
            >
              <ArrowLeft className="h-4 w-4" />
              Hub
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            >
              {theme === "light" ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              )}
            </button>
          </div>
        }
      />

      <main
        className={cn(
          hub.pageInner,
          "relative z-10 mx-auto w-full max-w-300 px-5 pt-7 pb-12 sm:px-8"
        )}
      >
        <div className="grid gap-10 lg:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[200px_minmax(0,1fr)_180px]">
          <DocumentOutline nodes={outline} activeId={activeId} />

          <article
            ref={articleRef}
            className="mx-auto min-w-0 w-full max-w-[80ch]"
            aria-labelledby="hki-article-title"
          >
            {/* Hero */}
            <header className="mb-14">
              <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
                Enterprise AI Isolation · v1.0
              </p>
              <h1
                id="hki-article-title"
                className="text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-[44px]"
              >
                Hermetic Knowledge Isolation
              </h1>
              <p className="mt-5 text-lg leading-8 text-muted-foreground">
                A runtime contract for enterprise agentic systems: every
                artifact belongs to one domain, every request runs in one active
                domain, and shared knowledge appears only through explicit
                publication — never silent global fallback.
              </p>

              <ContractPills className="mt-6" />

              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-success/35 bg-success/[0.08] px-2.5 py-0.5 font-bold uppercase tracking-[0.12em] text-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  Published
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />~{READING_TIME_MIN} min read
                </span>
                <span>By Henok Ghebrechristos, PhD</span>
              </div>
            </header>

            {/* Executive Brief */}
            <section aria-labelledby="executive-brief">
              <SectionLede
                id="executive-brief"
                eyebrow="Executive Brief"
                title="Autonomy changes the threat model."
                takeaway="Once agents rewrite, remember, retrieve, call tools, and start jobs, isolation stops being a database filter — it becomes the execution boundary that keeps autonomy from becoming cross-domain action."
              />
              <div className="mt-8 space-y-5">
                {RISK_SCENARIOS.map((s, i) => (
                  <RiskCard key={s.id} scenario={s} index={i} />
                ))}
              </div>

              <div className="mt-12">
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
            </section>

            {/* Interactive Runtime Contract */}
            <section aria-labelledby="runtime-contract" className="mt-20">
              <SectionLede
                id="runtime-contract"
                eyebrow="System Model · Interactive"
                title="One signed envelope, every step."
                takeaway="Click any stage of the request lifecycle to see what happens there and the boundary HKI enforces. The active domain is decided once at the gateway and travels — never gets re-derived — through retrieval, cache, graph, tools, and jobs."
              />
              <div className="mt-8">
                <RuntimeContractDiagram />
              </div>
            </section>

            {/* Full standard (markdown body) */}
            <section aria-labelledby="full-standard" className="mt-20">
              <SectionLede
                id="full-standard"
                eyebrow="Full Standard"
                title="The complete contract."
                takeaway="The remainder of the document covers system model, reference architecture, implementation surface, conformance tests, and the migration path."
              />
              <div className="mt-6">
                <ArticleMarkdown source={HKI_PAPER} imageUrls={IMAGE_URLS} />
              </div>
            </section>

            <ArticleFooter
              links={[
                {
                  label: "Open printable brief",
                  href: PRINTABLE_BRIEF_HREF,
                  icon: "printable",
                  external: true,
                },
                {
                  label: "View source",
                  href: SOURCE_HREF,
                  icon: "source",
                  external: true,
                },
                {
                  label: "Back to Engineering Hub",
                  href: ENGINEERING_HUB_ROUTE,
                  icon: "hub",
                  onNavigate: () => navigate(ENGINEERING_HUB_ROUTE),
                },
              ]}
            />
          </article>

          <OnThisPage nodes={outline} activeId={activeId} />
        </div>
      </main>
    </div>
  );
}
