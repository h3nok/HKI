import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@hki/ui";
import { FigureImage } from "../components/Figure";

function textFromNode(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textFromNode).join("");
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

const components = (imageUrls: Record<string, string>) => ({
  h2({ children }: { children?: ReactNode }) {
    const id = slugify(children);
    return (
      <h2
        id={id}
        className="mt-20 scroll-mt-24 border-t border-border/40 pt-12 text-[28px] font-bold leading-[1.15] tracking-tight text-foreground sm:text-3xl"
      >
        {children}
      </h2>
    );
  },
  h3({ children }: { children?: ReactNode }) {
    const id = slugify(children);
    return (
      <h3
        id={id}
        className="mt-10 scroll-mt-24 text-lg font-bold tracking-tight text-foreground"
      >
        {children}
      </h3>
    );
  },
  h4({ children }: { children?: ReactNode }) {
    return (
      <h4 className="mt-6 text-base font-semibold tracking-tight text-foreground">
        {children}
      </h4>
    );
  },
  p({ children }: { children?: ReactNode }) {
    return (
      <p className="my-4 text-base leading-[1.8] text-foreground/85">
        {children}
      </p>
    );
  },
  strong({ children }: { children?: ReactNode }) {
    return (
      <strong className="font-semibold text-foreground">{children}</strong>
    );
  },
  a({ href, children }: { href?: string; children?: ReactNode }) {
    const isExternal = href?.startsWith("http");
    return (
      <a
        href={href}
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noopener noreferrer" : undefined}
        className="inline-flex items-baseline gap-0.5 font-medium text-primary underline decoration-primary/30 underline-offset-4 transition-colors hover:text-primary/80 hover:decoration-primary/60"
      >
        {children}
        {isExternal && <ArrowUpRight className="h-3 w-3" />}
      </a>
    );
  },
  img({ src, alt }: { src?: string; alt?: string }) {
    const resolved = src ? (imageUrls[src] ?? src) : undefined;
    if (!resolved) return null;
    return (
      <FigureImage src={resolved} alt={alt ?? ""} caption={alt || undefined} />
    );
  },
  blockquote({ children }: { children?: ReactNode }) {
    return (
      <blockquote className="my-8 rounded-r-md border-l-[3px] border-primary bg-primary/5 py-4 pl-5 pr-4 text-foreground/90 not-italic">
        {children}
      </blockquote>
    );
  },
  ul({ children }: { children?: ReactNode }) {
    return (
      <ul className="my-4 list-disc space-y-1.5 pl-6 marker:text-muted-foreground/60">
        {children}
      </ul>
    );
  },
  ol({ children }: { children?: ReactNode }) {
    return (
      <ol className="my-4 list-decimal space-y-1.5 pl-6 marker:font-semibold marker:text-muted-foreground/60">
        {children}
      </ol>
    );
  },
  li({ children }: { children?: ReactNode }) {
    return (
      <li className="text-base leading-[1.8] text-foreground/85">
        {children}
      </li>
    );
  },
  table({ children }: { children?: ReactNode }) {
    return (
      <div className="my-8 overflow-x-auto rounded-lg border border-border/60">
        <table className="min-w-full text-left text-sm">{children}</table>
      </div>
    );
  },
  th({ children }: { children?: ReactNode }) {
    return (
      <th className="border-b border-border/60 bg-muted/40 px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        {children}
      </th>
    );
  },
  td({ children }: { children?: ReactNode }) {
    return (
      <td className="border-b border-border/30 px-4 py-3 align-top text-[14px] leading-6 text-foreground/85">
        {children}
      </td>
    );
  },
  code({ children }: { children?: ReactNode }) {
    return (
      <code className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[0.875em] text-foreground">
        {children}
      </code>
    );
  },
  pre({ children }: { children?: ReactNode }) {
    return (
      <pre className="my-6 overflow-x-auto rounded-lg border border-border/60 bg-zinc-950 p-4 text-[13px] leading-6 text-zinc-100">
        {children}
      </pre>
    );
  },
  hr() {
    return <hr className="my-12 border-border/50" />;
  },
});

export function ArticleMarkdown({
  source,
  imageUrls,
  className,
}: {
  source: string;
  imageUrls: Record<string, string>;
  className?: string;
}) {
  return (
    <div className={cn("hki-article antialiased", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components(imageUrls)}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
