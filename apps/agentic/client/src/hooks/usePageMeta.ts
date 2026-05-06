/**
 * usePageMeta — Sets document title and favicon for the current page.
 * Restores previous values on unmount.
 *
 * Usage:
 *   usePageMeta("Chat — Hermetic", "/favicon.svg");
 */

import { useEffect } from "react";

export function usePageMeta(title: string, faviconHref?: string) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;

    let prevFavicon: string | undefined;
    if (faviconHref) {
      const link = document.querySelector(
        "link[rel='icon']"
      ) as HTMLLinkElement | null;
      if (link) {
        prevFavicon = link.href;
        link.href = faviconHref;
      }
    }

    return () => {
      document.title = prevTitle;
      if (faviconHref && prevFavicon) {
        const link = document.querySelector(
          "link[rel='icon']"
        ) as HTMLLinkElement | null;
        if (link) link.href = prevFavicon;
      }
    };
  }, [title, faviconHref]);
}
