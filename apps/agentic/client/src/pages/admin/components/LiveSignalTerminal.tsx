import { useEffect, useState, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  Trash2,
  ShieldAlert,
  Cpu,
  Terminal,
  ArrowDown,
  ChevronRight,
  HelpCircle,
  Zap,
  Layers,
  Compass,
  Database,
  Key,
  ShieldX,
} from "lucide-react";
import {
  cn,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@hki/ui";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";
import { a } from "../theme";

interface Trace {
  id: string;
  query: string;
  confidence: number;
  latency?: number;
  tools?: string[];
  guardrails?: {
    input: string;
    output: string;
  };
  timestamp: Date | string;
  scope?: string;
}

interface LiveSignalTerminalProps {
  traces: Trace[];
  isLoading: boolean;
  className?: string;
  onViewAudit?: () => void;
}

interface LogLine {
  id: string;
  timestamp: string;
  type:
    | "system"
    | "gateway"
    | "tool"
    | "guardrail"
    | "success"
    | "warning"
    | "critical";
  message: string;
  metadata?: Record<string, string | number | boolean>;
}

// Generate deterministic synthetic SHA-256 signature representation based on ID
function getSha256(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return `0x${Math.abs(hash).toString(16).padStart(8, "0")}...${Math.abs(
    hash * 31
  )
    .toString(16)
    .slice(-8)}`;
}

const THREAT_PROFILES = [
  {
    id: "array_override",
    name: "Array Scope Override",
    invariant: "Invariant 4: No body-override",
    code: "HKI-C28",
    description:
      "Malicious payload attempts override via array-shaped scope parameter (e.g. ['payments', 'fraud']) inside request body to broaden signed gateway context.",
    payload: JSON.stringify(
      { scope: ["payments", "fraud"], action: "read_all" },
      null,
      2
    ),
    icon: Layers,
    color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    actionName: "Inject Array Override",
  },
  {
    id: "wildcard_inject",
    name: "Wildcard Domain Injection",
    invariant: "Invariant 1: Single active domain",
    code: "HKI-C23",
    description:
      "Exploit attempts to request '*' or 'global' as the active_domain scope to inherit multi-tenant visibility or bypass single-domain isolation.",
    payload: JSON.stringify(
      { envelope: { active_domain: "*", authorized_domains: ["*"] } },
      null,
      2
    ),
    icon: Compass,
    color: "text-rose-500 bg-rose-500/10 border-rose-500/20",
    actionName: "Inject Wildcard Attack",
  },
  {
    id: "cache_poison",
    name: "Cache Cross-Read Leak",
    invariant: "Invariant 3: Exact-match visibility",
    code: "HKI-C13",
    description:
      "Attacker attempts to query cached 'payments' context ledger while authenticated in 'hr' scope by utilizing non-isolated cache keys.",
    payload:
      "deriveHkiCacheKey({\n  envelope: { activeDomain: 'hr' },\n  operation: 'read_payments_ledger'\n})",
    icon: Database,
    color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    actionName: "Inject Cache Bypass",
  },
  {
    id: "expired_sig",
    name: "Expired/Forged Envelope",
    invariant: "Invariant 2: Fail-closed verification",
    code: "HKI-C05",
    description:
      "An attacker injects an expired token or manual signature forgery attempting to access a secured zone with an invalid gatekeeper secret.",
    payload:
      "envelope: {\n  signature: '0xf00baa...',\n  ttl: -60,\n  issued_at: 1779914560\n}",
    icon: Key,
    color: "text-purple-500 bg-rose-500/10 border-rose-500/20",
    actionName: "Inject Forged Envelope",
  },
];

export function LiveSignalTerminal({
  traces,
  isLoading,
  className,
  onViewAudit,
}: LiveSignalTerminalProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const colors = useMemo(() => {
    return {
      cardBg: "var(--card)",
      cardBorder: "var(--border)",
      headerBg: isDark
        ? "linear-gradient(to right, color-mix(in srgb, var(--primary) 10%, var(--card)), var(--card))"
        : "linear-gradient(to right, color-mix(in srgb, var(--primary) 8%, var(--card)), var(--card))",
      headerBorder: "var(--border)",
      consoleBg: isDark
        ? "linear-gradient(to bottom, color-mix(in srgb, var(--primary) 4%, #020408) 0%, #010204 100%)"
        : "linear-gradient(to bottom, #FFFFFF 0%, color-mix(in srgb, var(--primary) 3%, #FFFFFF) 100%)",
      textPrimary: isDark
        ? "text-[var(--text-heading)]"
        : "text-[var(--text-body)]",
      textTitle: "text-[var(--text-heading)]",
      textMuted: "text-[var(--text-muted)]",
      textTime: "text-[var(--text-disabled)]",
      metaBg: "var(--muted)",
      metaBorder: "var(--border)",
      buttonBg: "var(--card)",
      buttonBorder: "var(--border)",
      footerBg: isDark
        ? "linear-gradient(to right, var(--card), color-mix(in srgb, var(--primary) 10%, var(--card)))"
        : "linear-gradient(to right, var(--card), color-mix(in srgb, var(--primary) 8%, var(--card)))",
      footerBorder: "var(--border)",
      helpBg: "var(--muted)",
      helpBorder: "var(--border)",
    };
  }, [isDark]);

  const [isPlaying, setIsPlaying] = useState(true);
  const [tickSpeed, setTickSpeed] = useState<0.5 | 1 | 2>(1);
  const [logs, setLogLines] = useState<LogLine[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [showThreatSimulator, setShowThreatSimulator] = useState(false);
  const [selectedThreat, setSelectedThreat] =
    useState<string>("array_override");
  const [activeDomainFilter, setActiveDomainFilter] = useState<string>("all");

  const pendingTracesRef = useRef<Trace[]>([]);
  const currentLogsRef = useRef<LogLine[]>([]);
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const handleInjectThreat = (type: string) => {
    const id = `threat_${type}_${Math.random().toString(36).substr(2, 9)}`;
    const newThreatTrace = {
      id,
      query:
        type === "array_override"
          ? "Get customer banking ledger"
          : type === "wildcard_inject"
            ? "Retrieve all internal documents"
            : type === "cache_poison"
              ? "Read payroll details"
              : "Execute wire transfer",
      confidence: 0.99,
      timestamp: new Date().toISOString(),
      scope: type === "cache_poison" ? "hr" : "payments",
      threatType: type,
      _logStep: 0,
    } as any;
    pendingTracesRef.current = [newThreatTrace, ...pendingTracesRef.current];
    setIsPlaying(true);
    toast.success(`Injected simulated threat: ${type}`, {
      description: "Gateway intercept logic active.",
    });
  };

  // Auto-scroll logic
  const scrollToBottom = () => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Convert incoming fresh traces into detailed terminal log sequences
  useEffect(() => {
    if (!traces || traces.length === 0) return;

    // Filter traces we haven't processed yet or aren't currently in queue/logs
    const existingIds = new Set([
      ...pendingTracesRef.current.map(t => t.id),
      ...currentLogsRef.current
        .map(l => l.metadata?.traceId as string)
        .filter(Boolean),
    ]);

    const newTraces = traces.filter(t => !existingIds.has(t.id));
    if (newTraces.length > 0) {
      // Prepend so they flow in order of arrival
      pendingTracesRef.current = [
        ...newTraces.reverse(),
        ...pendingTracesRef.current,
      ];
    }
  }, [traces]);

  // Tick scheduler to dequeue traces and stream them line-by-line
  useEffect(() => {
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }

    if (!isPlaying) return;

    const baseDelay = 1200;
    const intervalDelay = baseDelay / tickSpeed;

    intervalIdRef.current = setInterval(() => {
      if (pendingTracesRef.current.length === 0) return;

      const nextTrace = pendingTracesRef.current[0];
      // Keep track of which step we are on inside this trace's multi-line log generation
      const step = nextTrace as any;
      if (step._logStep === undefined) {
        step._logStep = 0;
      }

      const traceId = nextTrace.id;
      const tStr = new Date(nextTrace.timestamp).toLocaleTimeString();
      const sha = getSha256(traceId);
      const isBlocked =
        nextTrace.guardrails?.output === "blocked" ||
        nextTrace.guardrails?.input === "flagged";
      const isThreat = traceId.startsWith("threat_");

      let line: LogLine | null = null;

      if (isThreat) {
        const threatType = (nextTrace as any).threatType;
        switch (step._logStep) {
          case 0:
            if (threatType === "array_override") {
              line = {
                id: `${traceId}-0`,
                timestamp: tStr,
                type: "gateway",
                message: "Ingressing payload with request body scope context",
                metadata: {
                  active_domain: "payments",
                  payload_scope: "['payments', 'fraud']",
                },
              };
            } else if (threatType === "wildcard_inject") {
              line = {
                id: `${traceId}-0`,
                timestamp: tStr,
                type: "gateway",
                message: "Ingressing envelope payload at edge boundary",
                metadata: {
                  active_domain: "*",
                  authorized_domains: "['*']",
                  hki_version: "1.0",
                },
              };
            } else if (threatType === "cache_poison") {
              line = {
                id: `${traceId}-0`,
                timestamp: tStr,
                type: "gateway",
                message: "HkiEnvelope gateway validated for 'hr' scope context",
                metadata: {
                  active_domain: "hr",
                  authorized_domains: "['hr', 'recruiting']",
                  status: "VERIFIED",
                },
              };
            } else {
              // expired_sig
              line = {
                id: `${traceId}-0`,
                timestamp: tStr,
                type: "gateway",
                message: "Validating incoming envelope header metadata",
                metadata: {
                  envelope_id: "env_forged_382",
                  issuer: "untrusted-client",
                },
              };
            }
            break;
          case 1:
            if (threatType === "array_override") {
              line = {
                id: `${traceId}-1`,
                timestamp: tStr,
                type: "warning",
                message:
                  "AST Check: Body parameter override attempt detected (P06 / Invariant 4)",
                metadata: {
                  handler: "executeTool",
                  parameter: "scope",
                  shape: "ARRAY",
                },
              };
            } else if (threatType === "wildcard_inject") {
              line = {
                id: `${traceId}-1`,
                timestamp: tStr,
                type: "warning",
                message:
                  "Envelope verification failed: Wildcard active domain is forbidden",
                metadata: {
                  code: "HKI-C23",
                  field: "active_domain",
                  value: "*",
                },
              };
            } else if (threatType === "cache_poison") {
              line = {
                id: `${traceId}-1`,
                timestamp: tStr,
                type: "system",
                message: "CACHE REQUEST -> READ 'payments_ledger_v2'",
                metadata: {
                  operation: "retrieve",
                  cache_policy: "strict-bind",
                },
              };
            } else {
              // expired_sig
              line = {
                id: `${traceId}-1`,
                timestamp: tStr,
                type: "warning",
                message:
                  "Verifying HMAC-SHA256 signature against registered gatekeeper secret",
                metadata: {
                  check: "verifyEnvelopeSignature",
                  signature_present: "true",
                },
              };
            }
            break;
          case 2:
            if (threatType === "array_override") {
              line = {
                id: `${traceId}-2`,
                timestamp: tStr,
                type: "critical",
                message:
                  "INVARIANT VIOLATION: Array-shaped scope argument attempts to broaden signed context",
                metadata: {
                  code: "HKI-C28",
                  expected: "payments",
                  attempted: "payments, fraud",
                },
              };
            } else if (threatType === "wildcard_inject") {
              line = {
                id: `${traceId}-2`,
                timestamp: tStr,
                type: "critical",
                message:
                  "INVARIANT VIOLATION: Ingress of non-empty wildcard domain is an attack vector (Invariant 1)",
                metadata: {
                  check: "isForbiddenRuntimeDomain",
                  action: "reject",
                },
              };
            } else if (threatType === "cache_poison") {
              line = {
                id: `${traceId}-2`,
                timestamp: tStr,
                type: "warning",
                message:
                  "Deriving HKI domain-scoped cache key via deriveHkiCacheKey() (P11)",
                metadata: {
                  derived_key:
                    "cache_key:org_acme_retail:hr:payments_ledger_v2:pp_standard_v1.0",
                },
              };
            } else {
              // expired_sig
              line = {
                id: `${traceId}-2`,
                timestamp: tStr,
                type: "critical",
                message:
                  "SECURITY ALERT: Envelope signature is invalid, tampered, or expired (Invariant 2)",
                metadata: {
                  code: "HKI-C05",
                  error: "expired-envelope",
                  details: "signature-invalid",
                },
              };
            }
            break;
          case 3:
            if (threatType === "array_override") {
              line = {
                id: `${traceId}-3`,
                timestamp: tStr,
                type: "critical",
                message:
                  "GATEKEEPER BLOCKED: Terminating transaction execution. Zero-trust boundary enforced.",
                metadata: { status: "403_FORBIDDEN", error: "scope-override" },
              };
            } else if (threatType === "wildcard_inject") {
              line = {
                id: `${traceId}-3`,
                timestamp: tStr,
                type: "critical",
                message:
                  "GATEKEEPER BLOCKED: Connection refused. Null/Global/Wildcard active scopes are terminal errors.",
                metadata: {
                  status: "401_UNAUTHORIZED",
                  error: "invalid-domain",
                },
              };
            } else if (threatType === "cache_poison") {
              line = {
                id: `${traceId}-3`,
                timestamp: tStr,
                type: "success",
                message:
                  "CACHE SECURED: Mismatch on 'payments' vs 'hr' keys prevents cache leakage (HKI-C13)",
                metadata: {
                  matching: "MISMATCH",
                  outcome: "SAFE_CACHE_MISS",
                  target_domain: "hr",
                },
              };
            } else {
              // expired_sig
              line = {
                id: `${traceId}-3`,
                timestamp: tStr,
                type: "critical",
                message:
                  "GATEKEEPER BLOCKED: Discarding untrusted scope. Fail-closed default. Status: 401 Unauthorized.",
                metadata: {
                  status: "401_UNAUTHORIZED",
                  action: "TERMINATE_SESSION",
                },
              };
            }
            // Mark threat trace as fully processed and dequeue
            pendingTracesRef.current.shift();
            break;
        }
      } else {
        // multi-step stream output per trace
        switch (step._logStep) {
          case 0:
            line = {
              id: `${traceId}-0`,
              timestamp: tStr,
              type: "gateway",
              message: `HkiEnvelope gateway validated for scope context`,
              metadata: {
                traceId,
                SHA256: sha,
                active_domain: nextTrace.scope || "global",
                status: "VERIFIED",
              },
            };
            break;
          case 1:
            line = {
              id: `${traceId}-1`,
              timestamp: tStr,
              type: "system",
              message: `QUERY INGESTION -> "${nextTrace.query.slice(0, 50)}${nextTrace.query.length > 50 ? "..." : ""}"`,
              metadata: {
                traceId,
                confidence: `${Math.round(nextTrace.confidence * 100)}%`,
              },
            };
            break;
          case 2:
            if (nextTrace.tools && nextTrace.tools.length > 0) {
              line = {
                id: `${traceId}-2`,
                timestamp: tStr,
                type: "tool",
                message: `DISPATCHING TOOLWORKFLOW -> [${nextTrace.tools.join(", ")}]`,
                metadata: { traceId, count: nextTrace.tools.length },
              };
            } else {
              step._logStep++; // Skip to guardrails
              return;
            }
            break;
          case 3:
            line = {
              id: `${traceId}-3`,
              timestamp: tStr,
              type: isBlocked ? "critical" : "guardrail",
              message: `GUARDRAIL CHECK -> input: ${nextTrace.guardrails?.input || "pass"} | output: ${nextTrace.guardrails?.output || "pass"}`,
              metadata: {
                traceId,
                verdict: isBlocked ? "VIOLATION_BLOCKED" : "COMPLIANT",
              },
            };
            break;
          case 4:
            line = {
              id: `${traceId}-4`,
              timestamp: tStr,
              type: isBlocked ? "critical" : "success",
              message: isBlocked
                ? `TRANSACTION REJECTED: fail-closed safety invariant enforced`
                : `TRACE COMPLETED IN ${nextTrace.latency?.toFixed(2) || "0.4"}s | response hash verified`,
              metadata: {
                traceId,
                confidence: `${Math.round(nextTrace.confidence * 100)}%`,
                SHA256: sha,
              },
            };
            // Mark trace as fully processed and dequeue
            pendingTracesRef.current.shift();
            break;
        }
      }

      if (line) {
        step._logStep++;
        const updatedLogs = [...currentLogsRef.current, line].slice(-80); // Cap at 80 lines to conserve memory
        currentLogsRef.current = updatedLogs;
        setLogLines(updatedLogs);
        setTimeout(scrollToBottom, 50);
      }
    }, intervalDelay);

    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
      }
    };
  }, [isPlaying, tickSpeed]);

  const handleClear = () => {
    currentLogsRef.current = [];
    setLogLines([]);
  };

  const domains = useMemo(() => {
    const list = new Set<string>();
    logs.forEach(l => {
      if (l.metadata?.active_domain) {
        list.add(l.metadata.active_domain as string);
      }
    });
    return ["all", ...Array.from(list)];
  }, [logs]);

  const filteredLogs = useMemo(() => {
    if (activeDomainFilter === "all") return logs;
    return logs.filter(l => l.metadata?.active_domain === activeDomainFilter);
  }, [logs, activeDomainFilter]);

  return (
    <div
      style={{
        background: colors.cardBg,
        borderColor: colors.cardBorder,
        boxShadow: isDark
          ? "0 24px 50px -12px rgba(0,0,0,0.7)"
          : "0 8px 30px rgba(0,0,0,0.04)",
      }}
      className={cn(
        "flex flex-col rounded-xl border overflow-hidden relative min-h-120 transition-all duration-300",
        isDark ? "text-slate-100" : "text-slate-800",
        className
      )}
    >
      {/* Terminal Title / Header */}
      <div
        style={{
          background: colors.headerBg,
          borderBottomColor: colors.headerBorder,
        }}
        className="px-5 pt-4 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b transition-colors duration-300"
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span
                className={cn(
                  "absolute inline-flex h-full w-full rounded-full opacity-75",
                  isPlaying
                    ? "animate-ping bg-emerald-500"
                    : isDark
                      ? "bg-slate-600"
                      : "bg-slate-400"
                )}
              ></span>
              <span
                className={cn(
                  "relative inline-flex rounded-full h-2 w-2",
                  isPlaying
                    ? "bg-emerald-500"
                    : isDark
                      ? "bg-slate-500"
                      : "bg-slate-400"
                )}
              ></span>
            </span>
            <span
              style={{ color: "var(--primary)" }}
              className="font-mono text-[10px] uppercase tracking-[0.18em] font-bold"
            >
              Live telemetry playback terminal
            </span>
          </div>
          <p
            className={cn(
              "mt-1 text-sm font-semibold tracking-wide transition-colors duration-300",
              colors.textTitle
            )}
          >
            HKI signed envelope telemetry flow
          </p>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {onViewAudit && (
            <button
              onClick={onViewAudit}
              style={{
                borderColor: "var(--plane-admin-border)",
                backgroundColor: "var(--plane-admin-muted)",
                color: "var(--plane-admin)",
              }}
              className="px-2.5 py-1.5 h-8 text-[10px] font-mono font-bold hover:brightness-110 active:brightness-95 rounded-lg border transition-all duration-150 flex items-center gap-1.5 animate-fade-in"
            >
              Audit Plane →
            </button>
          )}

          {/* Threat Simulator Toggle */}
          <button
            onClick={() => setShowThreatSimulator(!showThreatSimulator)}
            style={{
              borderColor: showThreatSimulator
                ? "rgba(225, 29, 72, 0.4)"
                : colors.buttonBorder,
              background: showThreatSimulator
                ? "rgba(225, 29, 72, 0.1)"
                : colors.buttonBg,
            }}
            className={cn(
              "px-2.5 h-8 rounded-lg border transition-all duration-150 flex items-center justify-center gap-1.5",
              showThreatSimulator
                ? "text-rose-500 font-bold"
                : isDark
                  ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
            )}
            title="Red-Team Threat Simulator"
          >
            <ShieldAlert className="size-3.5" />
            <span className="hidden sm:inline text-[10px] font-mono tracking-wide">
              Threat Simulator
            </span>
          </button>

          {/* Pause / Play */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            style={{
              borderColor: isPlaying
                ? "rgba(16, 185, 129, 0.3)"
                : colors.buttonBorder,
              background: isPlaying
                ? "rgba(16, 185, 129, 0.1)"
                : colors.buttonBg,
            }}
            className={cn(
              "p-1.5 rounded-lg border transition-all duration-150 flex items-center justify-center",
              isPlaying
                ? "text-emerald-500 hover:bg-emerald-500/20"
                : isDark
                  ? "text-slate-300 hover:bg-slate-700"
                  : "text-slate-600 hover:bg-slate-100"
            )}
            title={isPlaying ? "Pause Stream" : "Resume Stream"}
          >
            {isPlaying ? (
              <Pause className="size-3.5" />
            ) : (
              <Play className="size-3.5" />
            )}
          </button>

          {/* Speed Multiplier */}
          <div
            style={{
              background: colors.buttonBg,
              borderColor: colors.buttonBorder,
            }}
            className="flex items-center rounded-lg border p-0.5 transition-colors duration-300"
          >
            {([0.5, 1, 2] as const).map(speed => (
              <button
                key={speed}
                onClick={() => setTickSpeed(speed)}
                style={
                  tickSpeed === speed
                    ? {
                        backgroundColor: "var(--primary)",
                        color: "var(--primary-foreground)",
                        boxShadow:
                          "0 2px 4px color-mix(in srgb, var(--primary) 25%, transparent)",
                      }
                    : undefined
                }
                className={cn(
                  "px-2 py-0.5 text-[10px] font-mono font-semibold rounded-md transition-all duration-150",
                  tickSpeed !== speed &&
                    (isDark
                      ? "text-slate-400 hover:text-slate-200"
                      : "text-slate-500 hover:text-slate-800")
                )}
              >
                {speed}x
              </button>
            ))}
          </div>

          {/* Filter Domain */}
          {domains.length > 1 && (
            <Select
              value={activeDomainFilter}
              onValueChange={setActiveDomainFilter}
            >
              <SelectTrigger
                style={{
                  background: colors.buttonBg,
                  borderColor: colors.buttonBorder,
                }}
                className={cn(
                  a.field,
                  "h-8 w-32 rounded-lg text-[10px] font-mono border px-2.5 py-1.5 flex items-center justify-between gap-1 transition-colors duration-300",
                  isDark ? "text-slate-200" : "text-slate-700"
                )}
              >
                <SelectValue placeholder="all domains" />
              </SelectTrigger>
              <SelectContent className="admin-select-content">
                {domains.map(d => (
                  <SelectItem
                    key={d}
                    value={d}
                    className={cn(
                      "font-mono text-xs",
                      isDark ? "text-slate-300" : "text-slate-700"
                    )}
                  >
                    {d === "all" ? "all domains" : d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Clear Buffer */}
          <button
            onClick={handleClear}
            style={{
              background: colors.buttonBg,
              borderColor: colors.buttonBorder,
            }}
            className={cn(
              "p-1.5 rounded-lg border transition-all duration-150",
              isDark ? "text-slate-400" : "text-slate-500",
              "hover:text-rose-500 hover:bg-rose-500/10 hover:border-rose-500/20"
            )}
            title="Clear Console Buffer"
          >
            <Trash2 className="size-3.5" />
          </button>

          {/* Help Toggle */}
          <button
            onClick={() => setShowHelp(!showHelp)}
            style={{
              borderColor: showHelp ? "var(--primary)" : colors.buttonBorder,
              background: showHelp
                ? "color-mix(in srgb, var(--primary) 12%, transparent)"
                : colors.buttonBg,
            }}
            className={cn(
              "p-1.5 rounded-lg border transition-all duration-150",
              showHelp
                ? "text-[var(--primary)]"
                : isDark
                  ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
            )}
            title="Show Terminal Metadata Info"
          >
            <HelpCircle className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Info / Help HUD Panel */}
      <AnimatePresence>
        {showHelp && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{
              background: colors.helpBg,
              borderBottomColor: colors.helpBorder,
            }}
            className={cn(
              "border-b px-5 py-3 text-xs overflow-hidden transition-colors duration-300",
              isDark ? "text-slate-300" : "text-slate-600"
            )}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span
                  className={cn(
                    "font-bold",
                    isDark ? "text-slate-100" : "text-slate-800"
                  )}
                >
                  Plumbed Connection:
                </span>{" "}
                This terminal hooks directly to the production{" "}
                <code className="font-mono text-[var(--primary)] text-[11px] font-semibold">
                  trpc.governance.recentTraces
                </code>{" "}
                database query loop, scheduling individual traces to stream
                line-by-line.
              </div>
              <div>
                <span
                  className={cn(
                    "font-bold",
                    isDark ? "text-slate-100" : "text-slate-800"
                  )}
                >
                  Aesthetic Details:
                </span>{" "}
                Visualizes cryptographic envelope signatures, exact-match domain
                isolation tests, and guardrail decisions under the **6 Hermetic
                Invariants**.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Red-Team Threat Simulator Dashboard */}
      <AnimatePresence>
        {showThreatSimulator && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{
              background: isDark
                ? "linear-gradient(to bottom, color-mix(in srgb, var(--primary) 8%, var(--card)), var(--card))"
                : "linear-gradient(to bottom, color-mix(in srgb, var(--primary) 4%, #F8FAFC), #FFFFFF)",
              borderBottomColor: colors.helpBorder,
            }}
            className="border-b overflow-hidden transition-all duration-300"
          >
            <div className="px-5 py-4 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="size-4 text-rose-500 animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-500 font-mono">
                    Red-Team Threat Simulator (Live Gateway Ingress)
                  </span>
                </div>
                <div className="text-[10px] font-mono text-[var(--text-muted)]">
                  Simulate zero-trust exploits to observe fail-closed
                  enforcement
                </div>
              </div>

              {/* Selector Tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {THREAT_PROFILES.map(profile => {
                  const ProfileIcon = profile.icon;
                  const isSelected = selectedThreat === profile.id;
                  return (
                    <button
                      key={profile.id}
                      onClick={() => setSelectedThreat(profile.id)}
                      style={{
                        borderColor: isSelected
                          ? "rgba(225, 29, 72, 0.4)"
                          : colors.buttonBorder,
                        background: isSelected
                          ? isDark
                            ? "rgba(225, 29, 72, 0.15)"
                            : "rgba(225, 29, 72, 0.05)"
                          : colors.buttonBg,
                      }}
                      className={cn(
                        "p-2.5 rounded-lg border text-left transition-all duration-200 flex flex-col justify-between h-20 relative overflow-hidden group",
                        isSelected
                          ? "border-rose-500/50 shadow-sm"
                          : "hover:border-slate-500/30"
                      )}
                    >
                      <div className="flex items-start justify-between w-full">
                        <span
                          className={cn(
                            "p-1 rounded-md border shrink-0 transition-colors duration-200",
                            isSelected
                              ? "text-rose-500 border-rose-500/20 bg-rose-500/10"
                              : "text-slate-400 border-transparent bg-slate-500/5"
                          )}
                        >
                          <ProfileIcon className="size-3.5" />
                        </span>
                        <span className="font-mono text-[9px] font-bold text-rose-500 bg-rose-500/10 px-1 py-0.5 rounded">
                          {profile.code}
                        </span>
                      </div>
                      <div className="mt-2">
                        <div
                          className={cn(
                            "text-[10px] font-semibold truncate transition-colors duration-200",
                            isSelected ? colors.textTitle : colors.textMuted
                          )}
                        >
                          {profile.name}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Detail & Action View */}
              {selectedThreat &&
                (() => {
                  const activeProfile = THREAT_PROFILES.find(
                    p => p.id === selectedThreat
                  );
                  if (!activeProfile) return null;
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-black/5 dark:bg-black/25 p-3.5 rounded-lg border border-slate-500/10">
                      <div className="md:col-span-7 flex flex-col justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-rose-500/10 text-rose-500 rounded border border-rose-500/20">
                              {activeProfile.invariant}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              Check: {activeProfile.code}
                            </span>
                          </div>
                          <h4
                            className={cn(
                              "text-xs font-bold tracking-wide",
                              colors.textTitle
                            )}
                          >
                            {activeProfile.name}
                          </h4>
                          <p
                            className={cn(
                              "text-xs leading-relaxed",
                              colors.textMuted
                            )}
                          >
                            {activeProfile.description}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            onClick={() => handleInjectThreat(activeProfile.id)}
                            style={{
                              backgroundColor: "rgba(225, 29, 72, 0.9)",
                              boxShadow: "0 4px 12px rgba(225, 29, 72, 0.3)",
                            }}
                            className="px-4 py-2 text-xs font-mono font-bold text-white rounded-lg hover:brightness-110 active:scale-95 transition-all duration-150 flex items-center gap-2"
                          >
                            <Zap className="size-3.5 fill-current animate-pulse" />
                            {activeProfile.actionName}
                          </button>
                          <span className="text-[10px] font-mono text-rose-500/80 flex items-center gap-1">
                            <ShieldX className="size-3" /> Fail-Closed Active
                          </span>
                        </div>
                      </div>

                      <div className="md:col-span-5 flex flex-col justify-between">
                        <div>
                          <div className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                            <Terminal className="size-3" /> Exploit Payload
                            (JSON Ingress)
                          </div>
                          <pre className="p-2.5 rounded border bg-[#05070a] border-slate-800 text-[10px] font-mono text-emerald-400 overflow-x-auto whitespace-pre-wrap leading-normal shadow-inner max-h-[110px] terminal-scrollbar">
                            <code>{activeProfile.payload}</code>
                          </pre>
                        </div>
                      </div>
                    </div>
                  );
                })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Console Pane - Rich Obsidian High-Contrast Terminal */}
      <div
        style={{ background: colors.consoleBg }}
        className="flex-1 p-4 font-mono text-[11px] leading-relaxed overflow-y-auto max-h-[420px] select-text terminal-scrollbar shadow-inner transition-colors duration-300"
      >
        {isLoading && filteredLogs.length === 0 ? (
          <div
            className={cn(
              "flex flex-col items-center justify-center h-full py-16 gap-2",
              isDark ? "text-slate-500" : "text-slate-400"
            )}
          >
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <p className="mt-2 text-xs font-semibold">
              Plumbing live trace telemetry stream...
            </p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16 text-center gap-3">
            <Terminal
              className={cn(
                "size-8",
                isDark ? "text-slate-700" : "text-slate-300"
              )}
            />
            <div>
              <p className={cn("text-xs", colors.textMuted)}>
                Console buffer empty.
              </p>
              <p
                className={cn(
                  "text-[10px] mt-1",
                  isDark ? "text-slate-600" : "text-slate-400"
                )}
              >
                Waiting for next telemetry tick dispatch...
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredLogs.map(line => {
              const badgeColors = {
                system: isDark
                  ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                  : "bg-blue-50 text-blue-600 border-blue-200",
                gateway: isDark
                  ? "bg-purple-500/15 text-purple-400 border-purple-500/30"
                  : "bg-purple-50 text-purple-600 border-purple-200",
                tool: isDark
                  ? "bg-teal-500/15 text-teal-400 border-teal-500/30"
                  : "bg-teal-50 text-teal-600 border-teal-200",
                guardrail: isDark
                  ? "bg-orange-500/15 text-orange-400 border-orange-500/30"
                  : "bg-orange-50 text-orange-600 border-orange-200",
                success: isDark
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  : "bg-emerald-50 text-emerald-600 border-emerald-200",
                warning: isDark
                  ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                  : "bg-amber-50 text-amber-600 border-amber-200",
                critical: isDark
                  ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                  : "bg-rose-50 text-rose-600 border-rose-200",
              };

              return (
                <div
                  key={line.id}
                  className={cn(
                    "flex items-start gap-2.5 py-1 px-1.5 rounded transition-colors duration-100 group",
                    isDark ? "hover:bg-white/5" : "hover:bg-black/5"
                  )}
                >
                  <span className={cn("shrink-0 select-none", colors.textTime)}>
                    {line.timestamp}
                  </span>
                  <span
                    className={cn(
                      "px-1.5 py-0.5 text-[9px] font-bold rounded border shrink-0 uppercase tracking-wider",
                      badgeColors[line.type]
                    )}
                  >
                    {line.type}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span
                      className={cn(
                        "font-medium break-all transition-colors duration-300",
                        colors.textPrimary
                      )}
                    >
                      {line.message}
                    </span>

                    {/* Metadata line drawer if present */}
                    {line.metadata && (
                      <div
                        className={cn(
                          "text-[10px] mt-1 pl-2.5 border-l-2 flex flex-wrap gap-x-3.5 gap-y-1 transition-colors duration-300",
                          isDark
                            ? "text-slate-400 border-slate-700/60"
                            : "text-slate-500 border-slate-300"
                        )}
                      >
                        {Object.entries(line.metadata).map(([k, v]) => (
                          <span
                            key={k}
                            style={{
                              background: colors.metaBg,
                              borderColor: colors.metaBorder,
                            }}
                            className="px-1 py-0.5 rounded border transition-colors duration-300"
                          >
                            <span
                              className={
                                isDark ? "text-slate-500" : "text-slate-400"
                              }
                            >
                              {k}:
                            </span>{" "}
                            <span
                              className={cn(
                                "font-semibold",
                                isDark ? "text-emerald-400" : "text-emerald-600"
                              )}
                            >
                              {String(v)}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={terminalEndRef} />
          </div>
        )}
      </div>

      {/* Status Bar / Footer */}
      <div
        style={{
          background: colors.footerBg,
          borderTopColor: colors.footerBorder,
        }}
        className={cn(
          "px-5 py-2 border-t flex items-center justify-between text-[10px] transition-colors duration-300",
          colors.textMuted
        )}
      >
        <div className="flex items-center gap-3">
          <span>
            Buffer:{" "}
            <strong
              className={cn(
                "font-mono font-semibold",
                isDark ? "text-slate-200" : "text-slate-700"
              )}
            >
              {logs.length} / 80 lines
            </strong>
          </span>
          <span
            style={{ borderColor: colors.footerBorder }}
            className="hidden sm:inline border-r h-3"
          />
          <span className="hidden sm:inline">
            Speed:{" "}
            <strong
              className={cn(
                "font-mono font-semibold",
                isDark ? "text-slate-200" : "text-slate-700"
              )}
            >
              {tickSpeed}x
            </strong>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Cpu
            className={cn(
              "size-3 animate-pulse",
              isDark ? "text-emerald-400" : "text-emerald-600"
            )}
          />
          <span
            className={cn(
              "font-mono font-semibold uppercase tracking-wider text-[9px]",
              isDark ? "text-emerald-400" : "text-emerald-600"
            )}
          >
            HKI core cryptoshield active
          </span>
        </div>
      </div>
    </div>
  );
}
