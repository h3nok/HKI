import type { ReactNode } from "react";
import { cn } from "@hki/ui";

export function Figure({
  children,
  number,
  caption,
  notice,
  className,
}: {
  children: ReactNode;
  number?: number | string;
  caption?: ReactNode;
  notice?: ReactNode;
  className?: string;
}) {
  const label = number !== undefined ? `Fig. ${number}` : null;
  return (
    <figure className={cn("my-8 mx-auto w-full max-w-220", className)}>
      <div className="engineering-panel overflow-hidden">{children}</div>
      {(label || caption || notice) && (
        <figcaption className="mt-3 text-sm leading-6 text-muted-foreground">
          {(label || caption) && (
            <span className="block">
              {label && (
                <span className="mr-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  {label}
                </span>
              )}
              {caption && (
                <span className="font-medium text-foreground/85">
                  {caption}
                </span>
              )}
            </span>
          )}
          {notice && (
            <span className="mt-1 block text-xs italic text-muted-foreground">
              {notice}
            </span>
          )}
        </figcaption>
      )}
    </figure>
  );
}

export function FigureImage({
  src,
  alt,
  number,
  caption,
  notice,
}: {
  src: string;
  alt: string;
  number?: number | string;
  caption?: ReactNode;
  notice?: ReactNode;
}) {
  return (
    <Figure number={number} caption={caption} notice={notice}>
      <img src={src} alt={alt} loading="lazy" className="block w-full" />
    </Figure>
  );
}
