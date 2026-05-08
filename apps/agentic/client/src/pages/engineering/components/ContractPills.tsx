import { cn } from "@hki/ui";

export type ContractPill = {
  label: string;
  detail?: string;
};

export const HKI_CONTRACT: readonly ContractPill[] = [
  { label: "One request", detail: "one signed envelope" },
  { label: "One active domain", detail: "bound at the gateway" },
  { label: "No implicit global", detail: "publication is the only bridge" },
] as const;

export function ContractPills({
  pills = HKI_CONTRACT,
  className,
}: {
  pills?: readonly ContractPill[];
  className?: string;
}) {
  return (
    <ul className={cn("flex flex-wrap gap-2", className)}>
      {pills.map((p, i) => (
        <li
          key={p.label}
          className="inline-flex items-center gap-2.5 rounded-full border border-primary/25 bg-primary/5 px-3.5 py-1.5 text-xs"
        >
          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold tabular-nums text-primary">
            {i + 1}
          </span>
          <span className="font-semibold text-foreground">{p.label}</span>
          {p.detail && (
            <span className="text-muted-foreground/70">· {p.detail}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
