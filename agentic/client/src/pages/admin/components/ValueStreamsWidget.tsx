import { motion } from "framer-motion";
import { cn, textColor, HkiCard, StreamIcon } from "@hki/ui";
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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.4 }}
    >
      <HkiCard
        elevation="raised"
        size="md"
        interactive={false}
        className={cn(a.card, "relative flex flex-col overflow-hidden")}
      >
        <div
          className={cn(
            a.cardHeader,
            "px-5 pt-4 pb-3 flex items-center justify-between"
          )}
        >
          <div>
            <h2 className="text-sm font-medium text-foreground dark:text-foreground/78">
              Value Streams
            </h2>
            <p className="mt-1 text-[11px] text-muted-foreground/80">
              Active business domains and operator footprint.
            </p>
          </div>
          <button
            onClick={onManage}
            className={cn(
              a.toolbarButton,
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            )}
          >
            Manage <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>

        <div className="px-3 pb-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : streams.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10">
              <Layers className={cn("w-8 h-8", textColor.muted)} />
              <p className={cn("text-xs font-medium", textColor.muted)}>
                No value streams configured
              </p>
              <button
                onClick={onAddStream}
                className="text-[11px] font-semibold text-primary hover:underline"
              >
                Create your first stream →
              </button>
            </div>
          ) : (
            <div className="flex flex-col">
              <div className="max-h-[18rem] space-y-1 overflow-y-auto pr-1 scrollbar-thin">
                {streams.map((s, i) => (
                  <motion.button
                    key={s.id}
                    type="button"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.04 }}
                    onClick={() => onClickStream(s.id)}
                    className={cn(
                      a.previewRow,
                      "w-full text-left flex items-center gap-3.5 px-4 py-3.5 rounded-xl transition-all duration-200 hover:border-primary/20 hover:shadow-sm"
                    )}
                  >
                    <span className="shrink-0 text-foreground/70">
                      <StreamIcon id={s.icon} size={22} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-foreground dark:text-foreground/78 truncate">
                        {s.name}
                      </p>
                      <p
                        className={cn("text-[11px] truncate", textColor.muted)}
                      >
                        {s.description || "No description"}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "flex items-center gap-1 text-[10px] shrink-0",
                        textColor.muted
                      )}
                    >
                      <Users className="w-2.5 h-2.5" />
                      {s.userCount}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-medium px-2 py-0.5 rounded-md shrink-0 border",
                        s.isActive ? a.pillPositive : a.pillNeutral
                      )}
                    >
                      {s.isActive ? "Live" : "Idle"}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/45 transition-colors shrink-0" />
                  </motion.button>
                ))}
              </div>
              <div className="mt-3 border-t border-border/30 pt-3">
                <button
                  onClick={onAddStream}
                  className={cn(
                    a.inset,
                    "group flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-colors hover:border-primary/24 hover:text-foreground"
                  )}
                >
                  <span
                    className={cn(
                      a.iconPrimary,
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    )}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-semibold text-foreground/88">
                      Add Stream
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 block text-[11px]",
                        textColor.muted
                      )}
                    >
                      Create a new business domain and assign operators.
                    </span>
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground/55 transition-colors group-hover:text-primary" />
                </button>
              </div>
            </div>
          )}
        </div>
      </HkiCard>
    </motion.div>
  );
}
