#!/usr/bin/env node
// Copies the site to dist/ and inlines conformance.json for static hosting.
import { cpSync, mkdirSync, existsSync, readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "../..");
const dist = resolve(__dir, "dist");

console.log("Building hki.dev static website...");

// Ensure output directory exists
mkdirSync(dist, { recursive: true });

// Bundle CSS design system
const uiTokensDir = resolve(root, "packages/ui/tokens");
const cssFiles = [
  "fonts.css",
  "primitives.css",
  "semantic.css",
  "signature.css",
  "index.css",
  "themes/agentic.css",
];
let bundledCss = "";

for (const f of cssFiles) {
  const filePath = resolve(uiTokensDir, f);
  if (existsSync(filePath)) {
    let content = readFileSync(filePath, "utf8");
    // Strip imports from index.css to prevent browser loading warnings/errors
    if (f === "index.css") {
      content = content.replace(/@import\s+["'].*?["'];/g, "");
    }
    bundledCss += `\n/* ─── BUNDLED FROM: ${f} ─── */\n${content}\n`;
  } else {
    console.warn(`⚠ Missing token CSS file: ${f}`);
  }
}

writeFileSync(resolve(dist, "hki-design-system.css"), bundledCss, "utf8");
console.log("✓ hki-design-system.css bundled");

// Copy index.html
cpSync(resolve(__dir, "index.html"), resolve(dist, "index.html"));
console.log("✓ index.html copied");

// Copy favicons from apps/agentic/client/public/ to dist/
const publicDir = resolve(root, "apps/agentic/client/public");
if (existsSync(publicDir)) {
  const faviconFiles = [
    "favicon.svg",
    "favicon-knowledge.svg",
    "favicon-api.svg",
    "favicon-ops.svg",
  ];
  for (const fav of faviconFiles) {
    const srcFav = resolve(publicDir, fav);
    if (existsSync(srcFav)) {
      cpSync(srcFav, resolve(dist, fav));
    }
  }
  console.log("✓ Favicons copied to dist/");
}

// Copy conformance.json from repo root if present
const conformanceSrc = resolve(root, "conformance.json");
if (existsSync(conformanceSrc)) {
  cpSync(conformanceSrc, resolve(dist, "conformance.json"));
  console.log("✓ conformance.json embedded");
} else {
  console.warn(
    "⚠ conformance.json not found — registry section will use static defaults"
  );
}

// Copy pre-rendered HKI-package spec assets from docs/HKI-package/
const hkiPackageSrc = resolve(root, "docs/HKI-package");
if (existsSync(hkiPackageSrc)) {
  // Copy pre-rendered HTML specs with clean URLs
  const copySpecFile = (srcName, destName) => {
    const srcPath = resolve(hkiPackageSrc, srcName);
    if (existsSync(srcPath)) {
      cpSync(srcPath, resolve(dist, destName));
      console.log(`✓ Copied ${srcName} → ${destName}`);
    } else {
      console.warn(`⚠ Missing spec source file: ${srcName}`);
    }
  };

  copySpecFile("HERMETIC-KNOWLEDGE-ISOLATION.html", "standard.html");
  copySpecFile("custody_problem.html", "custody.html");
  copySpecFile("HKI-EXECUTIVE-BRIEF.html", "brief.html");
  copySpecFile("hki-paper.css", "hki-paper.css");

  // Copy images recursively
  const imagesSrc = resolve(hkiPackageSrc, "images");
  if (existsSync(imagesSrc)) {
    cpSync(imagesSrc, resolve(dist, "images"), { recursive: true });
    console.log("✓ SVG diagram assets recursively copied");
  } else {
    console.warn("⚠ HKI diagram images directory not found");
  }
} else {
  console.error("❌ Critical: docs/HKI-package directory not found");
}

console.log(`✓ site successfully built → ${dist}/`);
