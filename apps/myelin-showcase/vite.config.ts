import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5174 },
  resolve: {
    // In dev, point workspace packages to their source so Vite sees live TS.
    // In build, the compiled dist/ is used (standard node resolution).
    alias: {
      "@myelin/react": resolve(
        __dirname,
        "../../packages/myelin-react/src/index.ts"
      ),
      "@myelin/core": resolve(
        __dirname,
        "../../packages/myelin-core/src/index.ts"
      ),
      "@/components/ui/sidebar": resolve(
        __dirname,
        "../../packages/ui/src/components/sidebar-full.tsx"
      ),
    },
  },
});
