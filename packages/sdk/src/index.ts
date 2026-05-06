/**
 * @hki/sdk — Hermetic Knowledge Isolation SDK
 *
 * Full surface: runtime primitives + conformance suite.
 * For tree-shaking, prefer the sub-path imports:
 *   import { ... } from "@hki/sdk/runtime"
 *   import { ... } from "@hki/sdk/conformance"
 */
export * from "./runtime";
export * from "./conformance";
