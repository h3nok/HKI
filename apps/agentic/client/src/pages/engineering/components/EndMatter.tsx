import { useState } from "react";
import {
  ArrowUpRight,
  Check,
  Copy,
  FileText,
  GitBranch,
  Home,
} from "lucide-react";
import { cn } from "@hki/ui";

type EndMatterLink = {
  label: string;
  href: string;
  external?: boolean;
  onNavigate?: () => void;
};

type EndMatterVersion = {
  version: string;
  date: string;
  note: string;
};

type EndMatterEvidence = {
  label: string;
  value: string;
};

/**
 * EndMatter — the publication's closing module.
 *
 * Citation block (copyable), version history, signed evidence, and a small
 * row of canonical links. Distinct from the live app's "next action" CTAs.
 */
export function EndMatter({
  citation,
  versions,
  evidence,
  printableHref,
  sourceHref,
  hubHref,
  onNavigateHub,
  className,
}: {
  citation: string;
  versions: readonly EndMatterVersion[];
  evidence: readonly EndMatterEvidence[];
  printableHref: string;
  sourceHref: string;
  hubHref: string;
  onNavigateHub: () => void;
  className?: string;
}) {
  return (
    <footer className={cn("mt-32 border-t border-border/50 pt-16", className)}>
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
        End matter
      </p>

      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <CitationBlock citation={citation} />
        <VersionList versions={versions} />
      </div>

      {evidence.length > 0 && (
        <EvidenceRow evidence={evidence} className="mt-12" />
      )}

      <CanonicalLinks
        printableHref={printableHref}
        sourceHref={sourceHref}
        hubHref={hubHref}
        onNavigateHub={onNavigateHub}
        className="mt-16"
      />
    </footer>
  );
}

function CitationBlock({ citation }: { citation: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(citation);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        Cite this work
      </p>
      <div className="group relative mt-4 overflow-hidden rounded-md border border-border/60 bg-muted/15">
        <pre className="overflow-x-auto px-5 py-4 text-[12.5px] leading-6 text-foreground/85">
          <code className="font-mono">{citation}</code>
        </pre>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? "Copied" : "Copy citation"}
          className="absolute right-2 top-2 inline-flex h-7 items-center gap-1.5 rounded border border-border/60 bg-background/80 px-2 text-[11px] font-semibold text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
        >
          {copied ? (
            <Check className="h-3 w-3" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function VersionList({ versions }: { versions: readonly EndMatterVersion[] }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        Version history
      </p>
      <ol className="mt-4 divide-y divide-border/50 border-y border-border/50">
        {versions.map(v => (
          <li
            key={`${v.version}-${v.date}`}
            className="grid grid-cols-[auto_1fr_auto] items-baseline gap-4 py-3 text-[13px]"
          >
            <span className="font-mono text-[11px] font-semibold tracking-wide text-foreground">
              {v.version}
            </span>
            <span className="text-muted-foreground">{v.note}</span>
            <span className="font-mono text-[11px] text-muted-foreground/70">
              {v.date}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function EvidenceRow({
  evidence,
  className,
}: {
  evidence: readonly EndMatterEvidence[];
  className?: string;
}) {
  return (
    <div className={cn("border-t border-border/40 pt-8", className)}>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        Signed evidence
      </p>
      <dl className="mt-4 grid gap-x-10 gap-y-3 text-[12.5px] sm:grid-cols-2 lg:grid-cols-4">
        {evidence.map(e => (
          <div key={e.label}>
            <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/80">
              {e.label}
            </dt>
            <dd
              className="mt-1 truncate font-mono text-[12px] text-foreground/85"
              title={e.value}
            >
              {e.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function CanonicalLinks({
  printableHref,
  sourceHref,
  hubHref,
  onNavigateHub,
  className,
}: {
  printableHref: string;
  sourceHref: string;
  hubHref: string;
  onNavigateHub: () => void;
  className?: string;
}) {
  const links: ReadonlyArray<EndMatterLink & { icon: typeof FileText }> = [
    {
      label: "Printable brief",
      href: printableHref,
      external: true,
      icon: FileText,
    },
    { label: "View source", href: sourceHref, external: true, icon: GitBranch },
    {
      label: "Engineering hub",
      href: hubHref,
      onNavigate: onNavigateHub,
      icon: Home,
    },
  ];
  return (
    <div
      className={cn(
        "grid gap-3 border-t border-border/40 pt-8 sm:grid-cols-3",
        className
      )}
    >
      {links.map(l => {
        const Icon = l.icon;
        return (
          <a
            key={l.label}
            href={l.href}
            target={l.external ? "_blank" : undefined}
            rel={l.external ? "noopener noreferrer" : undefined}
            onClick={
              l.onNavigate
                ? e => {
                    e.preventDefault();
                    l.onNavigate?.();
                  }
                : undefined
            }
            className="group flex items-center justify-between gap-3 border-b border-transparent py-2 text-sm font-semibold text-foreground/85 transition-colors hover:border-foreground/40 hover:text-foreground"
          >
            <span className="inline-flex items-center gap-2.5">
              <Icon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
              {l.label}
            </span>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
          </a>
        );
      })}
    </div>
  );
}
