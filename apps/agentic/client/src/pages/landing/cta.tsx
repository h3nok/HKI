/**
 * CTA + Footer — Final conversion section and page footer.
 * Warm, token-based styling consistent with the HKI brand.
 */

import { HkiMark } from "@hki/ui";

// ── Footer ──────────────────────────────────────────────────────────────

export function Footer() {
  return (
    <footer
      id="footer"
      className="relative z-10 px-6 md:px-12 py-12 border-t border-border/20 dark:border-white/6 bg-card/30 backdrop-blur-sm"
    >
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 text-muted-foreground/40 text-xs">
          <HkiMark size={16} variant="color" />
          <span className="tracking-wide">
            © 2026 HKI · Hermetic Knowledge Isolation
          </span>
        </div>
        <div className="flex items-center gap-6 text-xs text-muted-foreground/40">
          <a href="#" className="hover:text-foreground/70 transition-colors">
            Privacy
          </a>
          <a href="#" className="hover:text-foreground/70 transition-colors">
            Terms
          </a>
          <a href="#" className="hover:text-foreground/70 transition-colors">
            Support
          </a>
        </div>
      </div>
    </footer>
  );
}
