import { useCallback, useMemo, useRef, type ReactNode } from "react";
import { useLocation } from "wouter";

import { HkiMark } from "@hki/ui";

import { DocumentOutline } from "./DocumentOutline";
import { EngineeringShell } from "./EngineeringShell";
import { PublicationMasthead } from "./PublicationMasthead";
import { ReadingProgress } from "./ReadingProgress";
import { useActiveHeading, useDocumentOutline } from "./useDocumentOutline";

export type ResearchArticleMeta = {
  eyebrow: string;
  title: string;
  abstract: string;
  authors: string;
  publishedOn: string;
  readingMinutes: number;
  version: string;
  beginHref: string;
};

export function ResearchArticleShell({
  meta,
  children,
  outlineDeps = [],
  footerLabel = "HKI Research",
}: {
  meta: ResearchArticleMeta;
  children: ReactNode;
  outlineDeps?: readonly unknown[];
  footerLabel?: string;
}) {
  const articleRef = useRef<HTMLElement>(null);
  const [, setLocation] = useLocation();

  const navigate = useCallback(
    (href: string) => {
      setLocation(href);
      const hash = href.split("#")[1];
      if (!hash) return;

      window.setTimeout(() => {
        document
          .getElementById(decodeURIComponent(hash))
          ?.scrollIntoView({ block: "start" });
      }, 0);
    },
    [setLocation]
  );

  const outline = useDocumentOutline(articleRef, outlineDeps);
  const headingIds = useMemo(() => outline.map(n => n.id), [outline]);
  const activeId = useActiveHeading(headingIds);

  return (
    <>
      <ReadingProgress trackRef={articleRef} />
      <EngineeringShell
        footerLeft={
          <div className="flex items-center gap-2">
            <HkiMark size={14} variant="color" />
            <span>{footerLabel}</span>
          </div>
        }
      >
        <div className="mx-auto w-full max-w-7xl px-5 pt-7 pb-12 sm:px-8">
          <div className="grid gap-10 xl:grid-cols-[220px_minmax(0,1fr)]">
            <DocumentOutline nodes={outline} activeId={activeId} />

            <article
              ref={articleRef}
              className="mx-auto min-w-0 w-full"
              aria-labelledby="hki-article-title"
            >
              <PublicationMasthead {...meta} onBegin={navigate} />
              {children}
            </article>
          </div>
        </div>
      </EngineeringShell>
    </>
  );
}
