/**
 * SidebarHeader — Agentic Command Center
 */

import { motion } from "framer-motion";
import { SquarePen, Search, FolderPlus, X } from "lucide-react";
import { Link } from "wouter";
import { AgenticIcon } from "@/components/ui/icons/AgenticIcon";
import { StreamIcon, STREAM_ICON_OPTIONS } from "@hki/ui";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

export interface SidebarHeaderProps {
  onNewTask: () => void;
  onNewProject: () => void;
  onClose?: () => void;
  isMobile?: boolean;
  onOpenSearch: () => void;
  homeHref?: string;
  activeStreamName?: string;
  activeStreamIcon?: string;
}

const ICON_BTN =
  "agentic-sidebar-icon-button flex items-center justify-center w-7 h-7 rounded-lg shrink-0 " +
  "border border-sidebar-border/50 bg-sidebar-accent/30 " +
  "text-sidebar-muted-foreground " +
  "hover:bg-primary/10 hover:border-primary/25 hover:text-primary " +
  "active:scale-95 transition-all duration-150 " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30";

const COMMAND_ICON_BTN =
  "agentic-sidebar-command-icon-button flex items-center justify-center w-9 h-9 shrink-0 " +
  "text-sidebar-muted-foreground hover:text-sidebar-foreground " +
  "active:scale-95 transition-all duration-150 " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30";

const KNOWN_STREAM_ICON_IDS = new Set(
  STREAM_ICON_OPTIONS.map(option => option.id)
);

function isEmojiIcon(icon: string | undefined | null): boolean {
  if (!icon) return false;
  return Array.from(icon).some(char => (char.codePointAt(0) ?? 0) > 0xff);
}

function ActiveStreamGlyph({ icon }: { icon?: string }) {
  if (
    icon &&
    KNOWN_STREAM_ICON_IDS.has(
      icon as (typeof STREAM_ICON_OPTIONS)[number]["id"]
    )
  ) {
    return <StreamIcon id={icon} size={12} className="shrink-0" />;
  }

  if (isEmojiIcon(icon)) {
    return <span className="shrink-0 leading-none">{icon}</span>;
  }

  return null;
}

export function SidebarHeader({
  onNewTask,
  onNewProject,
  onClose,
  isMobile,
  onOpenSearch,
  homeHref = "/chat",
  activeStreamName,
  activeStreamIcon,
}: SidebarHeaderProps) {
  return (
    <div className="agentic-sidebar-header shrink-0 flex flex-col select-none">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <Link
          to={homeHref}
          className="agentic-sidebar-brand group flex items-center gap-2.5 transition-opacity duration-200 hover:opacity-[0.78]"
          aria-label="Home"
        >
          <span className="agentic-sidebar-brand-mark">
            <AgenticIcon size={26} />
          </span>
          <div className="flex flex-col leading-none gap-0.75 min-w-0">
            <span className="text-[12px] font-bold tracking-[0.05em] uppercase leading-none text-foreground">
              <span>HKI</span> <span>Agent</span>
            </span>
            {activeStreamName && (
              <span className="flex items-center gap-1 text-[10px] text-sidebar-muted-foreground/58 tracking-normal truncate max-w-36">
                <ActiveStreamGlyph icon={activeStreamIcon} />
                {activeStreamName}
              </span>
            )}
          </div>
        </Link>

        {onClose && isMobile && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sidebar"
            className={ICON_BTN}
          >
            <X className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        )}
      </div>

      <div className="agentic-sidebar-command-wrap px-4 pb-3">
        <div className="agentic-sidebar-command-shell">
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.button
                type="button"
                onClick={onNewTask}
                whileHover={{ scale: 1.002 }}
                whileTap={{ scale: 0.992 }}
                className="agentic-sidebar-primary-action group relative flex min-w-0 flex-1 items-center justify-start gap-2 overflow-hidden
                           transition-shadow duration-200
                           focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                aria-label="New Task"
              >
                <span
                  className="agentic-sidebar-primary-action-sheen absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  aria-hidden="true"
                />
                <span className="agentic-sidebar-primary-action-icon">
                  <SquarePen className="w-3.5 h-3.5" strokeWidth={2.15} />
                </span>
                <span className="truncate text-[12px] font-semibold tracking-[0.02em]">
                  New Task
                </span>
              </motion.button>
            </TooltipTrigger>
            <TooltipContent side="bottom">New Task</TooltipContent>
          </Tooltip>

          <div
            className="agentic-sidebar-command-group"
            role="group"
            aria-label="Task tools"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onOpenSearch}
                  aria-label="Search (⌘K)"
                  className={COMMAND_ICON_BTN}
                >
                  <Search className="w-3.5 h-3.5" strokeWidth={2.35} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Search ⌘K</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onNewProject}
                  aria-label="New Project"
                  className={COMMAND_ICON_BTN}
                >
                  <FolderPlus className="w-3.5 h-3.5" strokeWidth={2.15} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">New Project</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      <div className="agentic-sidebar-section-rule flex items-center gap-2 px-4 pb-1.5">
        <span
          className="text-[10px] font-semibold uppercase tracking-widest shrink-0"
          style={{
            color:
              "color-mix(in srgb, var(--sidebar-muted-foreground) 40%, transparent)",
          }}
        >
          Tasks
        </span>
        <div
          className="flex-1 h-px"
          style={{
            background:
              "color-mix(in srgb, var(--sidebar-border) 40%, transparent)",
          }}
        />
      </div>
    </div>
  );
}
