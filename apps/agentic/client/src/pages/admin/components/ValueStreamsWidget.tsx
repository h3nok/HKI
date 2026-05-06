import { cn, HermeticCard, StreamIcon } from "@hki/ui";
import {
  Layers,
  ArrowUpRight,
  Loader2,
  Users,
  ChevronRight,
  Plus,
} from "lucide-react";
import { a } from "../theme";

interface Stream {
  id: string;
  name: string;
  description?: string | null;
  icon: string;
  userCount: number;
  isActive: boolean | number;
}

interface ValueStreamsWidgetProps {
  streams: Stream[];
  isLoading: boolean;
  onManage: () => void;
  onClickStream: (id: string) => void;
  onAddStream: () => void;
}

export function ValueStreamsWidget({
  streams,
  isLoading,
  onManage,
  onClickStream,
  onAddStream,
}: ValueStreamsWidgetProps) {
  return (
    <HermeticCard
      elevation="raised"
      size="md"
      interactive={false}
      className={cn(
        a.card,
        "relative flex flex-col overflow-hidden rounded-xl"
      )}
    >
      <div className="px-5 pt-4 pb-3 flex items-center justify-between">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80">
            Domains
          </span>
          <p className="mt-1 text-xs text-muted-foreground">
            Active isolation domains and operator footprint.
          </p>
        </div>
        <button
          onClick={onManage}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors duration-150"
        >
          Manage <ArrowUpRight className="size-3" />
        </button>
      </div>

      <div className="px-2 pb-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : streams.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10">
            <Layers className="size-8 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">
              No domains configured
            </p>
            <button
              onClick={onAddStream}
              className="text-[11px] font-semibold text-primary hover:underline"
            >
              Create your first domain →
            </button>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="max-h-72 space-y-0.5 overflow-y-auto pr-1">
              {streams.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onClickStream(s.id)}
                  className="group/row w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-150 hover:bg-muted/50"
                >
                  <span className="shrink-0 text-primary/82">
                    <StreamIcon id={s.icon} size={20} tone="mono" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-foreground truncate">
                      {s.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {s.description || "No description"}
                    </p>
                  </div>
                  <span className="flex items-center gap-1 text-[10px] tabular-nums shrink-0 text-muted-foreground">
                    <Users className="size-2.5" />
                    {s.userCount}
                  </span>
                  <span
                    className={cn(
                      "text-[9px] font-mono uppercase tracking-[0.14em] px-1.5 py-0.5 rounded-md shrink-0",
                      s.isActive
                        ? "bg-success/12 text-success"
                        : "bg-muted/60 text-muted-foreground"
                    )}
                  >
                    {s.isActive ? "Live" : "Idle"}
                  </span>
                  <ChevronRight className="size-3.5 text-muted-foreground/40 group-hover/row:text-muted-foreground transition-colors shrink-0" />
                </button>
              ))}
            </div>
            <button
              onClick={onAddStream}
              className="mt-1 group/add flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-150 hover:bg-muted/50"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
                <Plus className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-foreground">
                  Add domain
                </span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  Create a new active isolation boundary.
                </span>
              </span>
              <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground/40 group-hover/add:text-primary transition-colors" />
            </button>
          </div>
        )}
      </div>
    </HermeticCard>
  );
}
