import { execSync } from "node:child_process";
import fs from "node:fs";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

const appRoot = import.meta.dirname;
const packageJson = JSON.parse(
  fs.readFileSync(path.resolve(appRoot, "package.json"), "utf8")
) as {
  version?: string;
};

function resolveGitValue(command: string): string {
  try {
    return execSync(command, {
      cwd: appRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

const appVersion =
  process.env.VITE_APP_VERSION?.trim() || packageJson.version || "0.0.0";
const buildSha =
  process.env.VITE_BUILD_SHA?.trim() ||
  resolveGitValue("git rev-parse --short HEAD");
const rawBuildBranch =
  process.env.VITE_BUILD_BRANCH?.trim() ||
  resolveGitValue("git rev-parse --abbrev-ref HEAD");
const buildBranch = rawBuildBranch === "HEAD" ? "" : rawBuildBranch;
const buildDate =
  process.env.VITE_BUILD_DATE?.trim() || new Date().toISOString();

const plugins = [react(), tailwindcss()];

function manualChunks(id: string): string | undefined {
  if (id.includes("/packages/ui/")) {
    return "hki-ui";
  }

  if (id.includes("/node_modules/")) {
    if (id.includes("/lucide-react/")) {
      return "vendor-icons";
    }

    if (
      id.includes("/@radix-ui/") ||
      id.includes("/cmdk/") ||
      id.includes("/vaul/") ||
      id.includes("/sonner/") ||
      id.includes("/react-day-picker/")
    ) {
      return "vendor-ui";
    }

    if (
      id.includes("/framer-motion/") ||
      id.includes("/motion-dom/") ||
      id.includes("/motion-utils/")
    ) {
      return "vendor-motion";
    }

    if (
      id.includes("/recharts/") ||
      id.includes("/d3-") ||
      id.includes("/@xyflow/")
    ) {
      return "vendor-viz";
    }

    if (
      id.includes("/react-markdown/") ||
      id.includes("/react-syntax-highlighter/") ||
      id.includes("/remark-gfm/") ||
      id.includes("/streamdown/")
    ) {
      return "vendor-content";
    }
  }

  return undefined;
}

export default defineConfig({
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(appVersion),
    "import.meta.env.VITE_BUILD_SHA": JSON.stringify(buildSha),
    "import.meta.env.VITE_BUILD_BRANCH": JSON.stringify(buildBranch),
    "import.meta.env.VITE_BUILD_DATE": JSON.stringify(buildDate),
  },
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      // Force all React imports to use Agentic's React to prevent duplication
      react: path.resolve(import.meta.dirname, "node_modules/react"),
      "react-dom": path.resolve(import.meta.dirname, "node_modules/react-dom"),
    },
    // Dedupe React to prevent multiple instances when using workspace packages
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-grid-layout", "react-resizable"],
  },
  envDir: path.resolve(appRoot),
  root: path.resolve(appRoot, "client"),
  publicDir: path.resolve(appRoot, "client", "public"),
  build: {
    outDir: path.resolve(appRoot, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 850,
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
  server: {
    host: true,
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    watch: {
      // Use polling for better compatibility with some file systems
      usePolling: false,
      // Watch these directories for changes
      ignored: ["**/node_modules/**", "**/dist/**", "**/.git/**"],
    },
    hmr: {
      // Overlay shows errors in browser
      overlay: true,
    },
  },
});
