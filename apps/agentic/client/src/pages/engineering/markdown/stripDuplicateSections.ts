/**
 * Strips sections from the HKI markdown that are duplicated by the
 * interactive components above the markdown body.
 *
 * The brief replaces the doc's TL;DR / One-Picture Summary / Reader Guide /
 * Executive Summary / Why Autonomy Makes Isolation Fundamental / HKI at a
 * Glance, plus the H1 title (the page hero shows it).
 *
 * A "section" is the heading line and everything until the next H2 (##).
 */
const DROP_HEADINGS: readonly string[] = [
  "TL;DR",
  "One-Picture Summary",
  "Reader Guide",
  "Executive Summary",
  "Why Autonomy Makes Isolation Fundamental",
  "HKI at a Glance",
];

export function stripDuplicateSections(source: string): string {
  const lines = source.split("\n");
  const out: string[] = [];
  let skipping = false;
  let dropTitle = true;

  for (const line of lines) {
    // Drop the first H1 — the page hero takes that role.
    if (dropTitle && /^#\s+/.test(line)) {
      dropTitle = false;
      continue;
    }
    if (dropTitle) continue;

    const h2 = /^##\s+(.+?)\s*$/.exec(line);
    if (h2) {
      const title = h2[1].trim();
      skipping = DROP_HEADINGS.some(
        d => title.toLowerCase() === d.toLowerCase()
      );
      if (skipping) continue;
      out.push(line);
      continue;
    }
    if (skipping) continue;
    out.push(line);
  }

  // Collapse leading blank lines.
  return out.join("\n").replace(/^\s+/, "");
}
