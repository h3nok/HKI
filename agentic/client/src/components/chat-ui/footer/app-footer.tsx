/**
 * AppFooter - World-Class Application Footer
 *
 * Premium Features:
 * - Proper CSS variable theming
 * - Subtle gradient background
 * - Refined typography and spacing
 * - Important links (Terms, Privacy, Docs)
 * - Animated elements
 */

import { motion } from "framer-motion";
import {
  Info,
  ExternalLink,
  Shield,
  FileText,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { cn } from "@hki/ui";

// ============================================================================
// TYPES
// ============================================================================

interface AppFooterProps {
  variant?: "minimal" | "full";
  className?: string;
  showDisclaimer?: boolean;
}

// ============================================================================
// DESIGN TOKENS
// ============================================================================

const TOKENS = {
  spacing: {
    paddingY: 16, // 2 × 8px
    gap: 16,
    linkGap: 24,
  },
  fontSize: {
    disclaimer: 11,
    links: 12,
    copyright: 11,
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function AppFooter({
  variant = "minimal",
  className,
  showDisclaimer = true,
}: AppFooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <motion.footer
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.6, duration: 0.4 }}
      className={cn("relative w-full shrink-0", className)}
      role="contentinfo"
    >
      {/* Top gradient border — only on full variant */}
      {variant === "full" && (
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--border) 50%, transparent) 20%, color-mix(in srgb, var(--border) 80%, transparent) 50%, color-mix(in srgb, var(--border) 50%, transparent) 80%, transparent 100%)",
          }}
          aria-hidden
        />
      )}

      {/* Content container */}
      <div
        className="mx-auto w-full flex flex-col items-center justify-center"
        style={{
          paddingTop: variant === "full" ? TOKENS.spacing.paddingY : 8,
          paddingBottom: variant === "full" ? TOKENS.spacing.paddingY : 8,
          paddingLeft: 24,
          paddingRight: 24,
          gap: variant === "full" ? 12 : 8,
        }}
      >
        {/* Disclaimer - always visible */}
        {showDisclaimer && (
          <motion.div
            className="flex items-center justify-center gap-2"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <motion.div
              animate={{
                opacity: [0.4, 0.6, 0.4],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <Info
                className="w-3 h-3"
                style={{ color: "var(--muted-foreground)" }}
                aria-hidden
              />
            </motion.div>
            <p
              style={{
                fontSize: TOKENS.fontSize.disclaimer,
                letterSpacing: "0.01em",
                color:
                  "color-mix(in srgb, var(--muted-foreground) 70%, transparent)",
              }}
              role="note"
              aria-label="Disclaimer"
            >
              This can make mistakes. Verify sensitive information.
            </p>
          </motion.div>
        )}

        {/* Full footer: links and info */}
        {variant === "full" && (
          <>
            {/* Separator */}
            <div
              className="w-12 h-px my-1"
              style={{
                background:
                  "color-mix(in srgb, var(--border) 50%, transparent)",
              }}
              aria-hidden
            />

            {/* Copyright */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="flex items-center gap-1.5"
              style={{
                fontSize: TOKENS.fontSize.copyright,
                color:
                  "color-mix(in srgb, var(--muted-foreground) 50%, transparent)",
              }}
            >
              <Sparkles className="w-3 h-3" aria-hidden />
              <span>© {currentYear} HKI Agentic. All rights reserved.</span>
            </motion.div>
          </>
        )}
      </div>
    </motion.footer>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface FooterLinkProps {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}

function FooterLink({ href, icon: Icon, children }: FooterLinkProps) {
  return (
    <motion.a
      href={href}
      whileHover={{ y: -1 }}
      className="group flex items-center gap-1.5 transition-colors duration-200"
      style={{
        fontSize: TOKENS.fontSize.links,
        color: "var(--muted-foreground)",
      }}
    >
      <Icon className="w-3 h-3 transition-colors group-hover:text-primary" />
      <span className="group-hover:text-foreground transition-colors">
        {children}
      </span>
    </motion.a>
  );
}
