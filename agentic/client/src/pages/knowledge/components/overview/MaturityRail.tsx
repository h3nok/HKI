import { motion } from "framer-motion";
import { cn } from "@hki/ui";
import { k } from "../../theme";
import { HealthRing } from "./HealthRing";
import { healthColor, type MaturityResult } from "./maturity-model";

const EASE = [0.22, 1, 0.36, 1] as const;

export function MaturityRail({
  maturity,
  doneCount,
  totalSteps,
}: {
  maturity: MaturityResult;
  doneCount: number;
  totalSteps: number;
}) {
  const hc = healthColor(maturity.overall);

  return (
    <div
      className={cn(
        k.card,
        "lg:row-span-2 h-full flex flex-col justify-start px-4 py-4"
      )}
    >
      <div className="w-full flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-muted-foreground">
          Readiness
        </span>
        <span className={cn(k.mono, "font-semibold text-foreground")}>
          {doneCount}/{totalSteps}
        </span>
      </div>

      <div className="w-full flex justify-center mb-1">
        <HealthRing score={maturity.overall} color={hc.ring} size={76} />
      </div>

      <div className="w-full flex justify-center mb-2">
        <span
          className={cn(
            "px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-[0.04em]",
            hc.textCls
          )}
          style={{
            background: `color-mix(in srgb, ${hc.ring} 14%, transparent)`,
          }}
        >
          {hc.label}
        </span>
      </div>

      <div className="w-full mb-2">
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{
            background:
              "linear-gradient(90deg, var(--hki-red-500) 0%, var(--warning) 42%, var(--hki-blue-500) 100%)",
          }}
        />
        <div className="relative h-0">
          <motion.div
            className="absolute -top-1.25 w-2.5 h-2.5 rounded-full border border-background shadow"
            style={{ backgroundColor: hc.ring, transform: "translateX(-50%)" }}
            initial={{ left: "0%" }}
            animate={{
              left: `${Math.max(0, Math.min(100, maturity.overall))}%`,
            }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.2 }}
          />
        </div>
        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>Seed</span>
          <span>Agentic</span>
        </div>
      </div>

      <div className="w-full mt-1 space-y-1">
        {(
          [
            ["Content", maturity.content],
            ["Search", maturity.search],
            ["Pipeline", maturity.pipeline],
            ["Journey", maturity.journey],
            ["Adoption", maturity.adoption],
            ["Ops", maturity.ops],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="flex items-center gap-1">
            <span className="text-xs font-medium text-muted-foreground w-14 shrink-0">
              {label}
            </span>
            <div
              className={cn(
                "flex-1 h-1.5 rounded-full overflow-hidden",
                k.statusNeutralSurface
              )}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: healthColor(value).ring }}
                initial={{ width: 0 }}
                animate={{ width: `${value}%` }}
                transition={{ duration: 0.8, ease: EASE, delay: 0.5 }}
              />
            </div>
            <span
              className={cn(
                "text-xs font-semibold tabular-nums w-7 text-right",
                healthColor(value).textCls
              )}
            >
              {value}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-2 pt-1.5 border-t border-border/40 w-full text-center">
        <span className={cn(k.mono, "font-semibold text-foreground")}>
          {doneCount}/{totalSteps}
        </span>
        <span className={cn(k.muted, "text-xs")}> steps complete</span>
      </div>
    </div>
  );
}
