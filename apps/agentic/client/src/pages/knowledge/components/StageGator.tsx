import { motion } from "framer-motion";
import { Check, Key, Lock, ShieldCheck, UserCheck } from "lucide-react";
import { cn } from "@hki/ui";

export type GateStatus = "locked" | "processing" | "sealed";

export interface StageGate {
  id: number;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
}

export const ONBOARDING_GATES: StageGate[] = [
  {
    id: 1,
    title: "Principal Handshake",
    description: "Verify identity credentials and session signatures.",
    icon: UserCheck,
  },
  {
    id: 2,
    title: "Domain Negotiation",
    description: "Resolve active invite tokens and matching boundaries.",
    icon: Key,
  },
  {
    id: 3,
    title: "Policy Pact Accord",
    description: "Explicit binding agreement to Hermetic Isolation covenants.",
    icon: ShieldCheck,
  },
  {
    id: 4,
    title: "Envelope Seal & Mint",
    description: "Cryptographically seal the isolated domain envelope.",
    icon: ShieldCheck,
  },
];

interface StageGatorProps {
  gateStates: Record<number, GateStatus>;
  digests?: Record<number, string>;
  className?: string;
  gates?: StageGate[];
  title?: string;
  subtitle?: string;
}

export function StageGator({
  gateStates,
  digests = {},
  className,
  gates = ONBOARDING_GATES,
  title = "Security Stage Gates",
  subtitle = "Sequential cryptographically audited onboarding boundaries.",
}: StageGatorProps) {
  return (
    <div className={cn("space-y-6 rounded-3xl p-1", className)}>
      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/80">
          {title}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      </div>

      <div className="relative border-l border-border/40 pl-6 ml-3.5 space-y-6">
        {gates.map((gate, idx) => {
          const status = gateStates[gate.id] || "locked";
          const digest = digests[gate.id];
          const isLast = idx === gates.length - 1;

          const GateIcon = gate.icon;

          return (
            <div key={gate.id} className="relative group">
              {/* Connector line pulse indicator */}
              {!isLast && (
                <div
                  className={cn(
                    "absolute top-7 -left-[30px] bottom-0 w-[1px] transition-colors duration-500",
                    status === "sealed"
                      ? "bg-emerald-500/50"
                      : status === "processing"
                        ? "bg-primary/40 animate-pulse"
                        : "bg-border/30"
                  )}
                />
              )}

              {/* Bullet Node */}
              <div className="absolute -left-[37px] top-1">
                <motion.div
                  initial={false}
                  animate={{
                    scale: status === "processing" ? [1, 1.1, 1] : 1,
                  }}
                  transition={{
                    repeat: status === "processing" ? Infinity : 0,
                    duration: 1.5,
                  }}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full border text-xs transition-all duration-300 shadow-sm",
                    status === "sealed"
                      ? "bg-emerald-500/10 border-emerald-500 text-emerald-500 ring-4 ring-emerald-500/8"
                      : status === "processing"
                        ? "bg-primary/10 border-primary text-primary ring-4 ring-primary/8"
                        : "bg-card border-border text-muted-foreground/60"
                  )}
                >
                  {status === "sealed" ? (
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                  ) : status === "processing" ? (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                    </span>
                  ) : (
                    <Lock className="h-3 w-3" />
                  )}
                </motion.div>
              </div>

              {/* Text Card */}
              <div
                className={cn(
                  "rounded-2xl p-4 transition-all duration-300 ring-1",
                  status === "sealed"
                    ? "bg-emerald-500/3 ring-emerald-500/10"
                    : status === "processing"
                      ? "bg-primary/3 ring-primary/12 shadow-[0_4px_20px_rgba(var(--color-primary-rgb),0.03)]"
                      : "bg-card/40 ring-border/20 opacity-60"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3
                      className={cn(
                        "text-xs font-semibold uppercase tracking-wider",
                        status === "sealed"
                          ? "text-emerald-500"
                          : status === "processing"
                            ? "text-primary"
                            : "text-muted-foreground"
                      )}
                    >
                      {gate.title}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {gate.description}
                    </p>
                  </div>
                  <GateIcon
                    className={cn(
                      "h-4 w-4 shrink-0 mt-0.5",
                      status === "sealed"
                        ? "text-emerald-500"
                        : status === "processing"
                          ? "text-primary"
                          : "text-muted-foreground/40"
                    )}
                  />
                </div>

                {/* Telemetry / Cryptographic Digest */}
                {status === "sealed" && digest && (
                  <div className="mt-2.5 rounded-lg bg-emerald-500/5 px-2.5 py-1.5 font-mono text-[9px] text-emerald-500/80 border border-emerald-500/10 break-all select-all flex items-center justify-between">
                    <span>{digest}</span>
                    <span className="text-[8px] font-semibold uppercase tracking-wider bg-emerald-500/12 px-1 rounded text-emerald-600 shrink-0 ml-1.5">
                      Sealed
                    </span>
                  </div>
                )}

                {status === "processing" && (
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-primary/75 font-medium">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
                    </span>
                    <span>Waiting for credential validation...</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
