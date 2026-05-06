import { useCallback, type ReactNode } from "react";
import { useLocation } from "wouter";
import { usePageMeta } from "@/hooks/usePageMeta";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, ArrowUpRight, BookOpen, Moon, Sun } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  HkiMark,
  Topbar,
  cn,
  hub,
} from "@hki/ui";
import { AgenticGrid } from "@/pages/landing/agentic-grid";
import { useTheme } from "@/contexts/ThemeContext";
import {
  ENGINEERING_HUB_ROUTE,
  HKI_STANDARD_ROUTE,
} from "@/pages/engineering/constants";

import hkiPaper from "../../../../../docs/HKI-package/HERMETIC-KNOWLEDGE-ISOLATION.md?raw";
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

const KEY_SECTIONS = [
  { label: "TL;DR", href: "#tldr" },
  { label: "System Model", href: "#system-model" },
  { label: "Reference Architecture", href: "#reference-architecture" },
  { label: "Implementation Surface", href: "#implementation-surface" },
  { label: "Conformance Tests", href: "#conformance-and-regression-tests" },
  { label: "Migration Path", href: "#adoption-and-migration-path" },
] as const;

function textFromNode(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(textFromNode).join("");
  }

  if (node && typeof node === "object" && "props" in node) {
    return textFromNode(
      (node as { props?: { children?: ReactNode } }).props?.children
    );
  }

  return "";
}

function slugify(value: ReactNode) {
  return textFromNode(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const markdownComponents = {
  h1({ children }: { children?: ReactNode }) {
    return (
      <h1
        id={slugify(children)}
        className="mb-5 mt-0 max-w-3xl text-3xl font-black tracking-normal text-foreground sm:text-4xl"
      >
        {children}
      </h1>
    );
  },
  h2({ children }: { children?: ReactNode }) {
    return (
      <h2
        id={slugify(children)}
        className="max-w-3xl scroll-mt-28 border-t border-border/50 pt-10 text-2xl font-black tracking-normal text-foreground"
      >
        {children}
      </h2>
    );
  },
  h3({ children }: { children?: ReactNode }) {
    return (
      <h3
        id={slugify(children)}
        className="max-w-3xl scroll-mt-28 text-lg font-extrabold tracking-normal text-foreground"
      >
        {children}
      </h3>
    );
  },
  p({ children }: { children?: ReactNode }) {
    return (
      <p className="my-4 max-w-3xl leading-7 text-foreground/84">{children}</p>
    );
  },
  a({ href, children }: { href?: string; children?: ReactNode }) {
    const isExternal = href?.startsWith("http");
    return (
      <a
        href={href}
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noopener noreferrer" : undefined}
        className="inline-flex items-center gap-1 font-semibold text-primary underline decoration-primary/30 underline-offset-4 transition-colors hover:text-primary/80 hover:decoration-primary/60"
      >
        {children}
        {isExternal && <ArrowUpRight className="h-3.5 w-3.5" />}
      </a>
    );
  },
  img({ src, alt }: { src?: string; alt?: string }) {
    const resolvedSrc = src ? (IMAGE_URLS[src] ?? src) : undefined;

    return (
      <img
        src={resolvedSrc}
        alt={alt ?? ""}
        loading="lazy"
        className="my-6 w-full rounded-md border border-border/60 bg-white p-3 shadow-sm dark:bg-white"
      />
    );
  },
  blockquote({ children }: { children?: ReactNode }) {
    return (
      <blockquote className="my-6 max-w-3xl rounded-md border-l-4 border-primary bg-primary/6 px-5 py-3 text-foreground/88">
        {children}
      </blockquote>
    );
  },
  ul({ children }: { children?: ReactNode }) {
    return (
      <ul className="my-4 max-w-3xl list-disc space-y-2 pl-6 marker:text-primary/70">
        {children}
      </ul>
    );
  },
  ol({ children }: { children?: ReactNode }) {
    return (
      <ol className="my-4 max-w-3xl list-decimal space-y-2 pl-6 marker:font-bold marker:text-primary/70">
        {children}
      </ol>
    );
  },
  li({ children }: { children?: ReactNode }) {
    return <li className="pl-1 leading-7 text-foreground/84">{children}</li>;
  },
  table({ children }: { children?: ReactNode }) {
    return (
      <div className="my-6 overflow-x-auto rounded-md border border-border/60 bg-card/80 shadow-sm">
        <table className="min-w-full text-left text-sm">{children}</table>
      </div>
    );
  },
  th({ children }: { children?: ReactNode }) {
    return (
      <th className="border-b border-border/70 bg-muted/60 px-4 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
        {children}
      </th>
    );
  },
  td({ children }: { children?: ReactNode }) {
    return (
      <td className="border-b border-border/40 px-4 py-3 align-top leading-6 text-foreground/82">
        {children}
      </td>
    );
  },
  code({ children }: { children?: ReactNode }) {
    return (
      <code className="rounded bg-muted/70 px-1.5 py-0.5 font-mono text-[0.9em] text-primary">
        {children}
      </code>
    );
  },
  pre({ children }: { children?: ReactNode }) {
    return (
      <pre className="my-5 max-w-4xl overflow-x-auto rounded-md border border-border/60 bg-zinc-950 p-4 text-sm leading-6 text-zinc-100 shadow-sm">
        {children}
      </pre>
    );
  },
  hr() {
    return <hr className="my-8 border-border/70" />;
  },
};

export default function EngineeringStandardPage() {
  usePageMeta("HKI Standard Architecture");
  const [, setLocation] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const navigate = useCallback(
    (path: string) => setLocation(path),
    [setLocation]
  );

  return (
    <div className={hub.page}>
      <AgenticGrid />

      <Topbar
        variant="blur"
        showMenuTrigger={false}
        className="border-border/60! bg-background/88! backdrop-blur"
        leftContent={
          <a
            href={ENGINEERING_HUB_ROUTE}
            onClick={event => {
              event.preventDefault();
              navigate(ENGINEERING_HUB_ROUTE);
            }}
            className="flex items-center gap-3 transition-colors hover:text-primary"
          >
            <HkiMark size={28} variant="color" />
            <div className="flex flex-col">
              <span className="text-[13px] font-extrabold uppercase tracking-normal text-foreground">
                HKI Standard
              </span>
              <span className="mt-1 text-[11px] font-medium uppercase tracking-normal text-muted-foreground">
                Architecture Reader
              </span>
            </div>
          </a>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden rounded-md sm:inline-flex"
            >
              <a
                href={ENGINEERING_HUB_ROUTE}
                onClick={event => {
                  event.preventDefault();
                  navigate(ENGINEERING_HUB_ROUTE);
                }}
              >
                <ArrowLeft className="h-4 w-4" />
                Hub
              </a>
            </Button>
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
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
          "relative z-10 mx-auto w-full max-w-7xl px-5 py-8 sm:px-6 lg:px-8 lg:py-10"
        )}
      >
        <div className="mb-6 flex flex-col gap-4 border-b border-border/70 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge
              variant="outline"
              className="mb-4 rounded-md border-primary/35 bg-primary/8 text-primary tracking-normal"
            >
              HKI Package
            </Badge>
            <h1 className="max-w-3xl text-4xl font-extrabold leading-tight tracking-normal text-foreground sm:text-5xl">
              Standard Reader
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
              The architecture writeup is the canonical read path: runtime
              model, threat model, reference architecture, implementation
              surface, and conformance bar in one artifact.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm" className="rounded-md">
              <a
                href={ENGINEERING_HUB_ROUTE}
                onClick={event => {
                  event.preventDefault();
                  navigate(ENGINEERING_HUB_ROUTE);
                }}
              >
                <ArrowLeft className="h-4 w-4" />
                Engineering
              </a>
            </Button>
            <Button asChild size="sm" className="rounded-md">
              <a href="#reference-architecture">
                <BookOpen className="h-4 w-4" />
                Architecture
              </a>
            </Button>
          </div>
        </div>

        <nav className="mb-5 flex gap-2 overflow-x-auto pb-1 lg:hidden">
          {KEY_SECTIONS.map(section => (
            <a
              key={section.href}
              href={section.href}
              className="shrink-0 rounded-md border border-border/65 bg-card px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted/35 hover:text-foreground"
            >
              {section.label}
            </a>
          ))}
        </nav>

        <div className="grid w-full gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <Card className="sticky top-24">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm tracking-normal">
                  Read Path
                </CardTitle>
                <CardDescription>
                  Jump to the architecture and conformance sections.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-2">
                <nav className="space-y-1">
                  {KEY_SECTIONS.map(section => (
                    <a
                      key={section.href}
                      href={section.href}
                      className="block rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted/35 hover:text-foreground"
                    >
                      {section.label}
                    </a>
                  ))}
                </nav>
                <div className="mt-3 border-t border-border/60 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-normal text-muted-foreground">
                    Contract
                  </p>
                  <p className="mt-2 text-sm leading-6 text-foreground">
                    One active domain. Exact-domain visibility. No global
                    fallback.
                  </p>
                </div>
              </CardContent>
            </Card>
          </aside>

          <Card className="min-w-0">
            <CardContent className="p-5 sm:p-8 lg:p-10">
              <article className="standard-reader max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={markdownComponents}
                >
                  {hkiPaper}
                </ReactMarkdown>
              </article>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
