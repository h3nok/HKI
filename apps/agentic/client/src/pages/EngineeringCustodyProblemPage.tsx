import { useCallback, useMemo, useRef, type MouseEvent } from "react";
import { useLocation } from "wouter";
import { ArrowRight, FileText, GitBranch, Home } from "lucide-react";
import { HkiMark, cn, hub } from "@hki/ui";

import { usePageMeta } from "@/hooks/usePageMeta";
import {
  ENGINEERING_HUB_ROUTE,
  HKI_CUSTODY_PROBLEM_ROUTE,
  HKI_STANDARD_ROUTE,
} from "@/pages/engineering/constants";
import { EngineeringHeader } from "@/pages/engineering/components/EngineeringHeader";
import { PublicationMasthead } from "@/pages/engineering/components/PublicationMasthead";
import { DocumentOutline } from "@/pages/engineering/components/DocumentOutline";
import { ReadingProgress } from "@/pages/engineering/components/ReadingProgress";
import { ArticleMarkdown } from "@/pages/engineering/components/ArticleMarkdown";
import { ProseBlock } from "@/pages/engineering/components/WideSection";
import {
  useActiveHeading,
  useDocumentOutline,
} from "@/pages/engineering/components/useDocumentOutline";

import custodyProblemRaw from "../../../../../docs/HKI-package/custody_problem.md?raw";
import multiDomainDelegationUrl from "../../../../../docs/HKI-package/images/hki/07-multi-domain-delegation.svg";

const CUSTODY_PROBLEM = custodyProblemRaw
  .replace(/^# .*\n+/, "")
  .replace(
    /^\*\*Status:\*\*.*\n\*\*Version:\*\*.*\n\*\*Author:\*\*.*\n\*\*Relationship to HKI:\*\*.*\n+/,
    ""
  );
const READING_TIME_MIN = Math.max(
  1,
  Math.ceil(CUSTODY_PROBLEM.split(/\s+/).filter(Boolean).length / 220)
);

const SOURCE_HREF =
  "https://github.com/innovationlab/Hki/blob/main/docs/HKI-package/custody_problem.md";
const PACKAGE_HREF =
  "https://github.com/innovationlab/Hki/tree/main/docs/HKI-package";
const IMAGE_URLS: Record<string, string> = {
  "images/hki/07-multi-domain-delegation.svg": multiDomainDelegationUrl,
};

const PUBLICATION_LINKS = [
  {
    label: "Canonical Markdown",
    href: SOURCE_HREF,
    icon: FileText,
    external: true,
  },
  {
    label: "HKI Package",
    href: PACKAGE_HREF,
    icon: GitBranch,
    external: true,
  },
  {
    label: "Engineering Hub",
    href: ENGINEERING_HUB_ROUTE,
    icon: Home,
    external: false,
  },
] as const;

type Navigate = (path: string) => void;

function PublicationLinks({ onNavigate }: { onNavigate: Navigate }) {
  return (
    <div className="mt-8 grid gap-3 border-b border-border pb-8 sm:grid-cols-3">
      {PUBLICATION_LINKS.map(link => {
        const Icon = link.icon;
        const handleClick = link.external
          ? undefined
          : (event: MouseEvent<HTMLAnchorElement>) => {
              event.preventDefault();
              onNavigate(link.href);
            };
        return (
          <a
            key={link.label}
            href={link.href}
            target={link.external ? "_blank" : undefined}
            rel={link.external ? "noopener noreferrer" : undefined}
            onClick={handleClick}
            className="engineering-panel engineering-panel-interactive group flex items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span className="inline-flex items-center gap-2.5">
              <Icon className="h-4 w-4 text-primary" />
              {link.label}
            </span>
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
          </a>
        );
      })}
    </div>
  );
}

function ArticleFooter({ onNavigate }: { onNavigate: Navigate }) {
  return (
    <footer className="mt-24 border-t border-border pt-10">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
            Publishable artifact
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
            This research note is the canonical custody framing for HKI. The
            normative rules stay in the HKI 1.0 standard; this document explains
            why those rules exist and how to test custody as a falsifiable
            runtime property.
          </p>
        </div>
        <div className="space-y-2">
          <a
            href={HKI_STANDARD_ROUTE}
            onClick={event => {
              event.preventDefault();
              onNavigate(HKI_STANDARD_ROUTE);
            }}
            className="engineering-panel engineering-panel-interactive group flex items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Read HKI Standard
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
          </a>
          <a
            href={ENGINEERING_HUB_ROUTE}
            onClick={event => {
              event.preventDefault();
              onNavigate(ENGINEERING_HUB_ROUTE);
            }}
            className="engineering-panel engineering-panel-interactive group flex items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Back to Hub
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
          </a>
        </div>
      </div>
    </footer>
  );
}

export default function EngineeringCustodyProblemPage() {
  usePageMeta("HKI Custody Problem");
  const articleRef = useRef<HTMLElement>(null);
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

  const outline = useDocumentOutline(articleRef, [CUSTODY_PROBLEM]);
  const headingIds = useMemo(() => outline.map(n => n.id), [outline]);
  const activeId = useActiveHeading(headingIds);

  return (
    <div className="engineering-canvas flex min-h-screen flex-col font-sans text-foreground transition-colors">
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
              eyebrow="HKI Research Note · Runtime Custody"
              title="The Custody Problem in Enterprise Agentic AI"
              abstract="Access control asks who may enter. Custody asks whether scoped authority and scoped knowledge remain scoped after an agent retrieves, summarizes, caches, delegates across domains, remembers, and acts."
              authors="Henok Ghebrechristos, PhD"
              publishedOn="17 May 2026"
              readingMinutes={READING_TIME_MIN}
              version="2026-05-17"
              beginHref={`${HKI_CUSTODY_PROBLEM_ROUTE}#abstract`}
              onBegin={navigate}
            />

            <ProseBlock>
              <PublicationLinks onNavigate={navigate} />
            </ProseBlock>

            <ProseBlock className="mt-12">
              <ArticleMarkdown
                source={CUSTODY_PROBLEM}
                imageUrls={IMAGE_URLS}
              />
            </ProseBlock>

            <ProseBlock>
              <ArticleFooter onNavigate={navigate} />
            </ProseBlock>
          </article>
        </div>
      </main>

      <footer className="engineering-footer">
        <div className="mx-auto flex min-h-12 w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-3 text-xs text-muted-foreground sm:px-8">
          <div className="flex items-center gap-2">
            <HkiMark size={14} variant="color" />
            <span>HKI Custody Problem · Research Note</span>
          </div>
          <a
            href={ENGINEERING_HUB_ROUTE}
            onClick={event => {
              event.preventDefault();
              navigate(ENGINEERING_HUB_ROUTE);
            }}
            className="inline-flex items-center gap-1.5 font-medium outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Back to hub
            <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      </footer>
    </div>
  );
}
