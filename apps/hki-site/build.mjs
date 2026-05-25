#!/usr/bin/env node
// Copies the site to dist/ and inlines conformance.json for static hosting.
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "../..");
const dist = resolve(__dir, "dist");

mkdirSync(dist, { recursive: true });

// Copy index.html
cpSync(resolve(__dir, "index.html"), resolve(dist, "index.html"));

// Copy conformance.json from repo root if present
const conformanceSrc = resolve(root, "conformance.json");
if (existsSync(conformanceSrc)) {
  cpSync(conformanceSrc, resolve(dist, "conformance.json"));
  console.log("✓ conformance.json embedded");
} else {
  console.warn("⚠ conformance.json not found — registry section will use static defaults");
}

console.log(`✓ site built → ${dist}/`);
