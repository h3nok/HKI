import { defineConfig } from "tsup";

export default defineConfig(options => ({
  loader: {
    ".svg": "dataurl", // Inline SVGs as data URLs
  },
  entry: {
    index: "src/index.ts",
    "components/button": "src/components/button.tsx",
    "components/card": "src/components/card.tsx",
    "components/input": "src/components/input.tsx",
    "components/label": "src/components/label.tsx",
    "components/badge": "src/components/badge.tsx",
    "components/skeleton": "src/components/skeleton.tsx",
    "components/separator": "src/components/separator.tsx",
    "components/dialog": "src/components/dialog.tsx",
    "components/select": "src/components/select.tsx",
    "components/tooltip": "src/components/tooltip.tsx",
    "components/textarea": "src/components/textarea.tsx",
    "components/dropdown-menu": "src/components/dropdown-menu.tsx",
    "components/progress": "src/components/progress.tsx",
    "components/switch": "src/components/switch.tsx",
    "components/tabs": "src/components/tabs.tsx",
    "components/sheet": "src/components/sheet.tsx",
    "components/avatar": "src/components/avatar.tsx",
    "components/breadcrumb": "src/components/breadcrumb.tsx",
    "components/sidebar": "src/components/sidebar.tsx",
    "components/data-table": "src/components/data-table.tsx",
    "components/stats-card": "src/components/stats-card.tsx",
    // New core components
    "components/checkbox": "src/components/checkbox.tsx",
    "components/radio-group": "src/components/radio-group.tsx",
    "components/alert": "src/components/alert.tsx",
    "components/spinner": "src/components/spinner.tsx",
    "components/form": "src/components/form.tsx",
    "components/collapsible": "src/components/collapsible.tsx",
    // IPMS innovation patterns
    "components/stage-badge": "src/components/stage-badge.tsx",
    "components/priority-badge": "src/components/priority-badge.tsx",
    "components/kpi-card": "src/components/kpi-card.tsx",
    "components/innovation-funnel": "src/components/innovation-funnel.tsx",
    "components/empty-state": "src/components/empty-state.tsx",
    "components/initiative-card": "src/components/initiative-card.tsx",
    // Dashboard primitives
    "components/dashboard": "src/components/dashboard/index.ts",
    // Gamification primitives
    "components/gamification": "src/components/gamification/index.ts",
    // Layout & overlay components
    "components/topbar": "src/components/topbar.tsx",
    "components/context-panel": "src/components/context-panel.tsx",
    "components/app-layout": "src/components/app-layout.tsx",
    "components/scroll-area": "src/components/scroll-area.tsx",
    "components/popover": "src/components/popover.tsx",
    "components/command": "src/components/command.tsx",
    // Motion system
    "components/motion": "src/components/motion.tsx",
    // Agentic components
    "components/agentic/thought-trace": "src/components/agentic/thought-trace/index.ts",
    "components/agentic/core": "src/components/agentic/core/index.ts",
    "components/agentic/guardrails": "src/components/agentic/guardrails/index.ts",
    "components/agentic/tool-use": "src/components/agentic/tool-use/index.ts",
    "components/agentic/hitl": "src/components/agentic/hitl/index.ts",
    "components/agentic/execution": "src/components/agentic/execution/index.ts",
  },
  format: ["cjs", "esm"],
  tsconfig: "tsconfig.build.json",
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: !options.watch, // Only clean on full builds, not in watch mode
  external: ["react", "react-dom", "react-grid-layout", "react-resizable"],
  treeshake: true,
}));
