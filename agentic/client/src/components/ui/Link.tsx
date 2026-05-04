/**
 * Link Component — Single-tab navigation with accessibility
 *
 * Wraps wouter's Link with proper behavior:
 * - Normal click: Client-side navigation (same tab)
 * - Cmd/Ctrl+Click: Opens new tab (browser default)
 * - Middle click: Opens new tab (browser default)
 * - Right click: Shows context menu with "Open in new tab" option
 *
 * Usage:
 *   <Link href="/knowledge">Knowledge Base</Link>
 *   <Link href="/chat" className="btn">Start Chat</Link>
 */

import { forwardRef, type MouseEvent, type AnchorHTMLAttributes } from "react";
import { useLocation } from "wouter";

export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  /**
   * If true, always opens in new tab (adds target="_blank" rel="noopener noreferrer")
   */
  external?: boolean;
  /**
   * Custom click handler (called after navigation)
   */
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
}

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(
  ({ href, external, onClick, children, ...props }, ref) => {
    const [, setLocation] = useLocation();

    const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
      // Call custom onClick if provided
      onClick?.(e);

      // If external link or user wants new tab (Cmd/Ctrl/Middle click), let browser handle it
      if (
        external ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        e.button === 1 // Middle click
      ) {
        return; // Browser handles new tab
      }

      // Same-tab navigation — use wouter
      e.preventDefault();
      setLocation(href);
    };

    // External links get target="_blank" and security attributes
    const externalProps = external
      ? { target: "_blank", rel: "noopener noreferrer" }
      : {};

    return (
      <a
        ref={ref}
        href={href}
        onClick={handleClick}
        {...externalProps}
        {...props}
      >
        {children}
      </a>
    );
  }
);

Link.displayName = "Link";
