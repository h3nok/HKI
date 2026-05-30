import { Layers, Search, Sparkles, Users } from "lucide-react";
import { cn } from "@hki/ui";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { a } from "../theme";
import { TONE_STYLES } from "../constants";
import type { FeatureTab, SettingsTabNavItem } from "../types";

export function SettingsRail({
  tabs,
  activeTab,
  showSearch,
  searchValue,
  onSearchChange,
  onOpenPresets,
  onOpenUsers,
  onOpenStreams,
}: {
  tabs: SettingsTabNavItem[];
  activeTab: FeatureTab;
  showSearch: boolean;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onOpenPresets: () => void;
  onOpenUsers: () => void;
  onOpenStreams: () => void;
}) {
  return (
    <div className="xl:sticky xl:top-24">
      <nav
        className={cn(
          a.card,
          "flex flex-col overflow-hidden rounded-2xl xl:max-h-[calc(100vh-7rem)]"
        )}
      >
        {/* Rail header */}
        <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
          <p className="text-[13px] font-semibold text-foreground">Settings</p>
        </div>

        <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
          {/* ── Tab navigation ─────────────────────────────────── */}
          <TabsList
            className={cn(
              a.tabList,
              "admin-settings-vertical-tab-list flex h-auto w-full flex-col items-stretch justify-start gap-1 rounded-xl p-1.5 text-foreground"
            )}
          >
            {tabs.map(item => {
              const Icon = item.icon;
              const styles = TONE_STYLES[item.tone];
              const isActive = item.key === activeTab;

              return (
                <TabsTrigger
                  key={item.key}
                  value={item.key}
                  className={cn(
                    a.tabTrigger,
                    "group h-auto w-full justify-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors",
                    "data-[state=inactive]:bg-transparent data-[state=inactive]:hover:bg-accent/50",
                    "data-[state=active]:text-foreground data-[state=active]:after:hidden"
                  )}
                >
                  <div
                    className={cn(
                      isActive ? styles.iconClass : a.iconNeutral,
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <span className="flex-1 truncate text-[12px] font-semibold text-foreground">
                    {item.label}
                  </span>
                  {item.badge ? (
                    <Badge
                      variant="outline"
                      className={cn(
                        "shrink-0 rounded-full px-1.5 py-0 text-[9px] font-medium tabular-nums",
                        isActive && "border-primary/30 text-primary"
                      )}
                    >
                      {item.badge}
                    </Badge>
                  ) : null}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* ── Search (contextual) ──────────────────────────── */}
          {showSearch ? (
            <div className="relative mt-1 px-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
              <Input
                value={searchValue}
                onChange={event => onSearchChange(event.target.value)}
                placeholder="Search controls…"
                className={cn(a.field, "h-8 pl-8 text-[12px]")}
              />
            </div>
          ) : null}

          {/* ── Divider ──────────────────────────────────────── */}
          <div className="mx-2 my-1.5 h-px bg-border/40" />

          {/* ── Quick links ──────────────────────────────────── */}
          <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            Jump To
          </p>
          <button
            type="button"
            onClick={onOpenPresets}
            className={cn(
              a.previewRow,
              "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            )}
          >
            <div
              className={cn(
                a.iconPrimary,
                "flex h-6 w-6 items-center justify-center rounded-md"
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <span className="text-[12px] font-semibold text-foreground">
              Feature Flags
            </span>
          </button>
          <button
            type="button"
            onClick={onOpenUsers}
            className={cn(
              a.previewRow,
              "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            )}
          >
            <div
              className={cn(
                a.iconPrimary,
                "flex h-6 w-6 items-center justify-center rounded-md"
              )}
            >
              <Users className="h-3.5 w-3.5" />
            </div>
            <span className="text-[12px] font-semibold text-foreground">
              Users & Roles
            </span>
          </button>
          <button
            type="button"
            onClick={onOpenStreams}
            className={cn(
              a.previewRow,
              "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            )}
          >
            <div
              className={cn(
                a.iconPrimary,
                "flex h-6 w-6 items-center justify-center rounded-md"
              )}
            >
              <Layers className="h-3.5 w-3.5" />
            </div>
            <span className="text-[12px] font-semibold text-foreground">
              Domains
            </span>
          </button>
        </div>
      </nav>
    </div>
  );
}
