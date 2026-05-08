import { useEffect, useState, type RefObject } from "react";

export type OutlineNode = {
  id: string;
  text: string;
  level: 2 | 3;
};

/**
 * Walks the given root for h2/h3 elements with ids and returns a flat
 * outline list. Re-runs whenever `deps` change (e.g. after markdown render).
 */
export function useDocumentOutline(
  rootRef: RefObject<HTMLElement | null>,
  deps: readonly unknown[] = []
): OutlineNode[] {
  const [nodes, setNodes] = useState<OutlineNode[]>([]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const collect = () => {
      const headings = root.querySelectorAll<HTMLElement>("h2[id], h3[id]");
      const next: OutlineNode[] = [];
      headings.forEach(h => {
        const level = h.tagName === "H2" ? 2 : 3;
        next.push({
          id: h.id,
          text: h.textContent?.trim() ?? h.id,
          level: level as 2 | 3,
        });
      });
      setNodes(prev => {
        if (
          prev.length === next.length &&
          prev.every((p, i) => p.id === next[i].id && p.text === next[i].text)
        ) {
          return prev;
        }
        return next;
      });
    };

    collect();
    const obs = new MutationObserver(collect);
    obs.observe(root, { childList: true, subtree: true });
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootRef, ...deps]);

  return nodes;
}

/**
 * Tracks which h2/h3 in `ids` is currently nearest the top of the viewport.
 */
export function useActiveHeading(ids: readonly string[]): string {
  const [active, setActive] = useState<string>(ids[0] ?? "");

  useEffect(() => {
    if (!ids.length) return;
    const els = ids
      .map(id => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (!els.length) return;

    const obs = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top
          )[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 }
    );
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [ids]);

  return active;
}
