import { lazy, Suspense, useEffect, useState } from "react";
import { Badge } from "@hki/ui";
import { Network } from "lucide-react";
import {
  createThemeFromPrimaryToken,
  hkiTheme,
  type NeuralOrchestratorTheme,
} from "@myelin/react";
import { BreadcrumbBar } from "@/components/ui/breadcrumb-bar";
import { BrandLoader } from "@/components/ui/brand-loader";

// Lazy-load the heavy Three.js bundle — ~600KB, should not block the main chunk
const NeuralOrchestratorLazy = lazy(() =>
  import("@myelin/react").then(m => ({ default: m.NeuralOrchestrator }))
);

function cssColorToHex(input: string): number | null {
  if (typeof document === "undefined" || !document.body) return null;
  const probe = document.createElement("span");
  probe.style.display = "none";
  probe.style.color = input;
  document.body.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();

  const rgb = resolved.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!rgb) return null;
  const r = Math.max(0, Math.min(255, Number(rgb[1])));
  const g = Math.max(0, Math.min(255, Number(rgb[2])));
  const b = Math.max(0, Math.min(255, Number(rgb[3])));
  return (r << 16) | (g << 8) | b;
}

function readPrimaryTokenHex(): number | null {
  if (typeof document === "undefined") return null;
  const styles = getComputedStyle(document.documentElement);
  const token = styles.getPropertyValue("--primary").trim();
  if (!token) return null;
  return cssColorToHex(token);
}

export default function OrchestratorPage() {
  const [theme, setTheme] = useState<NeuralOrchestratorTheme>(hkiTheme);

  useEffect(() => {
    const refreshTheme = () => {
      const primary = readPrimaryTokenHex();
      if (primary == null) return;
      setTheme(createThemeFromPrimaryToken({ primary }));
    };

    refreshTheme();
    const observer = new MutationObserver(refreshTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme"],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="dashboard-shell dashboard-shell--admin admin-control-plane-canvas min-h-[calc(100svh-3.5rem)] overflow-hidden text-foreground">
      <BreadcrumbBar
        className="relative z-10"
        segments={[
          { label: "HKI Engine", icon: Network },
          { label: "Orchestrator" },
        ]}
        trailing={
          <Badge
            variant="outline"
            className="font-mono text-[10px] tracking-wide"
          >
            MYELIN PRIMARY TOKEN
          </Badge>
        }
      />

      <section className="relative z-10 px-4 sm:px-6 pb-6">
        <div className="relative h-[calc(100svh-5.5rem)] min-h-140 overflow-hidden rounded-2xl border border-border/60 bg-card/70 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.55)] backdrop-blur-sm">
          <Suspense fallback={<BrandLoader variant="fullscreen" />}>
            <NeuralOrchestratorLazy theme={theme} />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
