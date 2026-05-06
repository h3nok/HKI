/**
 * SidebarHeader — Agentic Command Center
 */

import { motion } from "framer-motion";
import { SquarePen, Search, FolderPlus, X } from "lucide-react";
import { Link } from "wouter";
import { AgenticIcon } from "@/components/ui/icons/AgenticIcon";
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
  "flex items-center justify-center w-7 h-7 rounded-lg shrink-0 " +
  "border border-sidebar-border/50 bg-sidebar-accent/30 " +
  "text-sidebar-muted-foreground " +
  "hover:bg-primary/10 hover:border-primary/25 hover:text-primary " +
  "active:scale-95 transition-all duration-150 " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30";

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
    <div className="shrink-0 flex flex-col select-none">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <Link
          to={homeHref}
          className="group flex items-center gap-2.5 transition-opacity duration-200 hover:opacity-[0.78]"
          aria-label="Home"
        >
          <AgenticIcon size={26} />
          <div className="flex flex-col leading-none gap-0.75 min-w-0">
            <span className="text-[12px] font-bold tracking-[0.05em] uppercase leading-none text-foreground">
              <span>Hermetic</span> <span>Agentic</span>
            </span>
            {activeStreamName && (
              <span className="text-[10px] text-sidebar-muted-foreground/58 tracking-normal truncate max-w-36">
                {activeStreamIcon && (
                  <span className="mr-0.5">{activeStreamIcon}</span>
                )}
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

      <div className="px-3 pb-3 flex items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.button
              type="button"
              onClick={onNewTask}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="group relative flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg
                         overflow-hidden transition-shadow duration-200
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              style={{
                background:
                  "linear-gradient(135deg, var(--sidebar-primary) 0%, color-mix(in srgb, var(--sidebar-primary) 80%, var(--primary)) 100%)",
                color: "var(--sidebar-primary-foreground)",
                boxShadow:
                  "inset 0 1px 0 color-mix(in srgb, white 18%, transparent), 0 1px 2px color-mix(in srgb, var(--foreground) 14%, transparent), 0 10px 22px -18px color-mix(in srgb, var(--sidebar-primary) 40%, transparent)",
              }}
              aria-label="New Task"
            >
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%)",
                }}
              />
              <SquarePen className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
              <span className="text-[12px] font-semibold tracking-wide">
                New Task
              </span>
            </motion.button>
          </TooltipTrigger>
          <TooltipContent side="bottom">New Task</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onOpenSearch}
              aria-label="Search (⌘K)"
              className={ICON_BTN}
            >
              <Search className="w-3.5 h-3.5" strokeWidth={2.5} />
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
              className={ICON_BTN}
            >
              <FolderPlus className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">New Project</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex items-center gap-2 px-4 pb-1.5">
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
