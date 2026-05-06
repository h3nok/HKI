/**
 * HKI conformance suite — run the certification test suite against
 * any runtime adapter to verify HKI compliance.
 *
 * @example
 * import { runHkiConformance, createRuntimeConformanceAdapter } from "@hki/sdk/conformance"
 */
export {
  HKI_CONFORMANCE_CASES,
  createRuntimeConformanceAdapter,
  formatConformanceReport,
  runHkiConformance,
} from "@hki/conformance";

export type * from "@hki/conformance";
