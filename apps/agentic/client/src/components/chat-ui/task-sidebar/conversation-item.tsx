/**
 * ConversationItem — Enterprise-Grade Agentic Conversation Card
 *
 * Features:
 * - Task status indicator with animated states (idle/running/completed/failed)
 * - Last-message preview snippet with single-line truncation
 * - Message count badge
 * - Inline rename: double-click/F2 → editable input, Enter to save, Escape to cancel
 * - Pin/unpin toggle with visual badge
 * - Delete via hover action (confirmation handled by parent)
 * - Search query highlighting in title
 * - Hover actions with proper pointer-events gating
 * - Accessible: role="button", keyboard navigation, aria-labels
 * - CSS variable theming, Framer Motion micro-interactions
 *
 * @module task-sidebar/conversation-item
 */

import { memo, useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  motion,
  useMotionValue,
  useTransform,
  useAnimation,
  PanInfo,
} from "framer-motion";
import {
  Zap,
  Pencil,
  Trash2,
  Pin,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Check,
  X,
  MessageSquare,
  Copy,
  FolderInput,
  FolderMinus,
  FolderPlus,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { TYPOGRAPHY, SPACING } from "@/design-system/tokens";

// ============================================================================
// TYPES
// ============================================================================

export type TaskStatus = "idle" | "running" | "completed" | "failed";

export interface ConversationItemProps {
  id: string;
  title: string;
  /** Preview of the last message in the conversation */
  lastMessage?: string;
  /** Total number of messages in the conversation */
  messageCount?: number;
  timestamp?: Date;
  isActive?: boolean;
  isPinned?: boolean;
  status?: TaskStatus;
  /** Domain scope this conversation belongs to */
  scope?: string;
  /** Current project ID this conversation belongs to */
  projectId?: string | null;
  /** Available projects for "Move to Project" context menu */
  projects?: { id: string; name: string; emoji: string }[];
  /** Search query to highlight in the title */
  searchQuery?: string;
  onSelect: (id: string) => void;
  onRename?: (id: string, newTitle: string) => void;
  onDelete?: (id: string) => void;
  onPin?: (id: string, isPinned: boolean) => void;
  /** Move conversation to a project (null = remove from project) */
  onMoveToProject?: (id: string, projectId: string | null) => void;
  /** Create a new project and immediately move this task into it */
  onCreateProjectFromTask?: (taskId: string, taskTitle: string) => void;
}

// ============================================================================
// STATUS CONFIG — Single source of truth for visual states
// ============================================================================

interface StatusVisual {
  icon: typeof Zap;
  color: string;
  bgColor: string;
  label: string;
}

const STATUS_CONFIG: Record<TaskStatus, StatusVisual> = {
  idle: {
    icon: Zap,
    color: "var(--sidebar-muted-foreground)",
    bgColor: "transparent",
    label: "Ready",
  },
  running: {
    icon: Loader2,
    color: "var(--sidebar-primary)",
    bgColor: "color-mix(in srgb, var(--sidebar-primary) 10%, transparent)",
    label: "Executing",
  },
  completed: {
    icon: CheckCircle2,
    color: "var(--success, #16a34a)",
    bgColor: "color-mix(in srgb, var(--success, #16a34a) 10%, transparent)",
    label: "Completed",
  },
  failed: {
    icon: AlertCircle,
    color: "var(--destructive)",
    bgColor: "color-mix(in srgb, var(--destructive) 10%, transparent)",
    label: "Failed",
  },
};

// ============================================================================
// HELPERS
// ============================================================================

/** Format a Date into a human-friendly relative string */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Highlight matching search text in title */
function HighlightedTitle({ text, query }: { text: string; query?: string }) {
  if (!query?.trim()) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={i}
            className="bg-primary/15 text-primary rounded-sm px-0.5"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

/** Tiny separator dot between metadata items */
function MetaDot() {
  return (
    <span
      className="text-[8px] mx-0.5"
      style={{
        color:
          "color-mix(in srgb, var(--sidebar-muted-foreground) 35%, transparent)",
      }}
    >
      •
    </span>
  );
}

// ============================================================================
// INLINE RENAME EDITOR — Extracted for SRP
// ============================================================================

interface InlineRenameProps {
  value: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

function InlineRenameEditor({
  value,
  onChange,
  onConfirm,
  onCancel,
}: InlineRenameProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        onConfirm();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    },
    [onConfirm, onCancel]
  );

  return (
    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={onConfirm}
        maxLength={200}
        className="flex-1 min-w-0 px-1.5 py-0.5 text-sm rounded-md
                           bg-sidebar-accent border border-sidebar-primary/40
                           focus:outline-none focus:ring-1 focus:ring-sidebar-primary/50
                           text-sidebar-foreground"
        style={{ fontSize: TYPOGRAPHY.bodySmall.size }}
      />
      <button
        type="button"
        onMouseDown={e => {
          e.preventDefault();
          onConfirm();
        }}
        className="p-0.5 rounded text-sidebar-primary hover:bg-sidebar-primary/10 transition-colors"
        aria-label="Save rename"
      >
        <Check className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onMouseDown={e => {
          e.preventDefault();
          onCancel();
        }}
        className="p-0.5 rounded text-sidebar-muted-foreground hover:bg-primary/8 hover:text-primary transition-colors"
        aria-label="Cancel rename"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ============================================================================
// CONTEXT MENU — Right-click actions
// ============================================================================

interface ContextMenuProps {
  x: number;
  y: number;
  isPinned: boolean;
  projectId?: string | null;
  projects?: { id: string; name: string; emoji: string }[];
  onClose: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  onPin?: () => void;
  onCopyId?: () => void;
  onMoveToProject?: (projectId: string | null) => void;
  onCreateProjectFromTask?: () => void;
}

function ContextMenu({
  x,
  y,
  isPinned,
  projectId,
  projects,
  onClose,
  onRename,
  onDelete,
  onPin,
  onCopyId,
  onMoveToProject,
  onCreateProjectFromTask,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showProjectSubmenu, setShowProjectSubmenu] = useState(false);

  useEffect(() => {
    const handler = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent && e.key === "Escape") {
        onClose();
        return;
      }
      if (
        e instanceof MouseEvent &&
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      )
        onClose();
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", handler);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  const adjustedStyle = {
    position: "fixed" as const,
    left: Math.min(x, window.innerWidth - 180),
    top: Math.min(y, window.innerHeight - 200),
    zIndex: 9999,
  };

  const itemClass = `flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium rounded-md transition-colors
        text-sidebar-foreground/80 hover:bg-primary/8 hover:text-primary`;

  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.12 }}
      style={adjustedStyle}
      className="bg-popover border border-border rounded-xl shadow-lg p-1 min-w-40"
      role="menu"
    >
      {onPin && (
        <button
          type="button"
          onClick={() => {
            onPin();
            onClose();
          }}
          className={itemClass}
          role="menuitem"
        >
          <Pin className="w-3.5 h-3.5" />
          {isPinned ? "Unpin" : "Pin to top"}
        </button>
      )}
      {onRename && (
        <button
          type="button"
          onClick={() => {
            onRename();
            onClose();
          }}
          className={itemClass}
          role="menuitem"
        >
          <Pencil className="w-3.5 h-3.5" />
          Rename
        </button>
      )}
      {onCopyId && (
        <button
          type="button"
          onClick={() => {
            onCopyId();
            onClose();
          }}
          className={itemClass}
          role="menuitem"
        >
          <Copy className="w-3.5 h-3.5" />
          Copy ID
        </button>
      )}
      {onMoveToProject && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowProjectSubmenu(!showProjectSubmenu)}
            className={itemClass}
            role="menuitem"
          >
            <FolderInput className="w-3.5 h-3.5" />
            {projectId ? "Move to project" : "Add to project"}
            <span className="ml-auto text-[10px] text-muted-foreground">▸</span>
          </button>
          {showProjectSubmenu && (
            <div className="absolute left-full top-0 ml-1 bg-popover border border-border rounded-xl shadow-lg p-1 min-w-36 z-50">
              {projectId && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onMoveToProject(null);
                      onClose();
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium rounded-md transition-colors text-sidebar-foreground/80 hover:bg-primary/8 hover:text-primary"
                    role="menuitem"
                  >
                    <FolderMinus className="w-3.5 h-3.5" />
                    Remove from project
                  </button>
                  <div className="my-1 h-px bg-border" />
                </>
              )}
              {projects
                ?.filter(p => p.id !== projectId)
                .map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onMoveToProject(p.id);
                      onClose();
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium rounded-md transition-colors text-sidebar-foreground/80 hover:bg-primary/8 hover:text-primary"
                    role="menuitem"
                  >
                    <span className="text-sm">{p.emoji}</span>
                    {p.name}
                  </button>
                ))}
              {/* Always show "New project" option */}
              {(projects?.length ?? 0) > 0 && (
                <div className="my-1 h-px bg-border" />
              )}
              {onCreateProjectFromTask && (
                <button
                  type="button"
                  onClick={() => {
                    onCreateProjectFromTask();
                    onClose();
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium rounded-md transition-colors text-primary hover:bg-primary/10"
                  role="menuitem"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  New project…
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {onDelete && (
        <>
          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            onClick={() => {
              onDelete();
              onClose();
            }}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium rounded-md transition-colors text-destructive hover:bg-destructive/10"
            role="menuitem"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </>
      )}
    </motion.div>
  );
}

// Swipe threshold (px) to trigger delete
const SWIPE_DELETE_THRESHOLD = -80;

// ============================================================================
// OVERFLOW MENU TRIGGER — Single ⋯ button that opens context menu
// ============================================================================

interface OverflowTriggerProps {
  visible: boolean;
  onClick: (e: React.MouseEvent) => void;
}

function OverflowTrigger({ visible, onClick }: OverflowTriggerProps) {
  const blockDrag = (e: React.PointerEvent) => e.stopPropagation();

  return (
    <div
      className="absolute right-2 top-1/2 -translate-y-1/2 z-20 transition-all duration-150"
      style={{
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
      }}
      onPointerDownCapture={blockDrag}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.button
            type="button"
            onClick={onClick}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            className="flex items-center justify-center rounded-md transition-colors
                                   text-sidebar-muted-foreground hover:text-primary
                                   hover:bg-primary/8"
            style={{ width: 28, height: 28 }}
            aria-label="More actions"
          >
            <MoreHorizontal className="w-4 h-4" />
          </motion.button>
        </TooltipTrigger>
        <TooltipContent side="right">More actions</TooltipContent>
      </Tooltip>
    </div>
  );
}

// ============================================================================
// CONVERSATION ITEM COMPONENT
// ============================================================================

export const ConversationItem = memo(function ConversationItem({
  id,
  title,
  lastMessage,
  messageCount,
  timestamp,
  isActive = false,
  isPinned = false,
  status = "idle",
  scope,
  searchQuery,
  onSelect,
  onRename,
  onDelete,
  onPin,
  projectId,
  projects,
  onMoveToProject,
  onCreateProjectFromTask,
}: ConversationItemProps) {
  const [showActions, setShowActions] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(title);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const config = STATUS_CONFIG[status];

  // Resolve the project this task belongs to (for visual badge)
  const assignedProject =
    projectId && projects ? projects.find(p => p.id === projectId) : null;

  // Swipe-to-delete gesture
  const swipeX = useMotionValue(0);
  const swipeBg = useTransform(
    swipeX,
    [-100, -60, 0],
    [
      "color-mix(in srgb, var(--destructive) 20%, transparent)",
      "color-mix(in srgb, var(--destructive) 10%, transparent)",
      "transparent",
    ]
  );
  const swipeControls = useAnimation();

  // ── Handlers ──

  const handleSelect = useCallback(() => {
    if (!isRenaming) onSelect(id);
  }, [id, onSelect, isRenaming]);

  const handleStartRename = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setRenameValue(title);
      setIsRenaming(true);
    },
    [title]
  );

  const handleConfirmRename = useCallback(() => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== title) {
      onRename?.(id, trimmed);
    }
    setIsRenaming(false);
  }, [id, renameValue, title, onRename]);

  const handleCancelRename = useCallback(() => {
    setRenameValue(title);
    setIsRenaming(false);
  }, [title]);

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete?.(id);
    },
    [id, onDelete]
  );

  const handlePin = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onPin?.(id, !isPinned);
    },
    [id, isPinned, onPin]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onRename) {
        setRenameValue(title);
        setIsRenaming(true);
      }
    },
    [title, onRename]
  );

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleCopyId = useCallback(() => {
    navigator.clipboard.writeText(id);
    toast.success("Task ID copied");
  }, [id]);

  const handleSwipeEnd = useCallback(
    (_: any, info: PanInfo) => {
      if (info.offset.x < SWIPE_DELETE_THRESHOLD && onDelete) {
        onDelete(id);
      }
      swipeControls.start({
        x: 0,
        transition: { type: "spring", stiffness: 400, damping: 30 },
      });
    },
    [id, onDelete, swipeControls]
  );

  return (
    <>
      <motion.div
        style={{ background: swipeBg }}
        className="relative rounded-xl overflow-hidden"
      >
        {/* Swipe delete indicator */}
        <motion.div
          className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-destructive"
          style={{ opacity: useTransform(swipeX, [-80, -40, 0], [1, 0.4, 0]) }}
        >
          <Trash2 className="w-4 h-4" />
          <span className="text-xs font-medium">Delete</span>
        </motion.div>

        <motion.div
          role="button"
          tabIndex={isRenaming ? -1 : 0}
          onClick={handleSelect}
          onContextMenu={handleContextMenu}
          onKeyDown={e => {
            if (isRenaming) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleSelect();
            }
            if (e.key === "F2" && onRename) {
              e.preventDefault();
              setRenameValue(title);
              setIsRenaming(true);
            }
            if (e.key === "Delete" || e.key === "Backspace") {
              e.preventDefault();
              onDelete?.(id);
            }
          }}
          onMouseEnter={() => setShowActions(true)}
          onMouseLeave={() => setShowActions(false)}
          drag="x"
          dragConstraints={{ left: -100, right: 0 }}
          dragElastic={0.15}
          onDragEnd={handleSwipeEnd}
          animate={swipeControls}
          whileTap={isRenaming ? undefined : { scale: 0.99 }}
          className={`relative w-full text-left px-3 py-3
                           focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
                           group rounded-lg cursor-pointer transition-all duration-150
                           ${
                             isActive
                               ? "bg-primary/10 border-l-[3px] border-l-primary text-primary shadow-[inset_0_0_0_1px_rgba(0,102,178,0.1)]"
                               : "text-sidebar-foreground hover:bg-primary/10 hover:text-primary border-l-[3px] border-l-transparent hover:border-l-primary/30"
                           }`}
          aria-current={isActive ? "true" : undefined}
          aria-label={`Task: ${title}`}
        >
          <div className="flex items-center gap-2 pr-7 min-w-0">
            {isRenaming ? (
              <InlineRenameEditor
                value={renameValue}
                onChange={setRenameValue}
                onConfirm={handleConfirmRename}
                onCancel={handleCancelRename}
              />
            ) : (
              <>
                {/* Running pulse dot */}
                {status === "running" && (
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <span
                      className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                      style={{ background: "var(--primary)" }}
                    />
                    <span
                      className="relative inline-flex rounded-full h-1.5 w-1.5"
                      style={{ background: "var(--primary)" }}
                    />
                  </span>
                )}
                {/* Pinned indicator */}
                {isPinned && status !== "running" && (
                  <Pin
                    className="w-3 h-3 shrink-0 text-primary/50"
                    strokeWidth={2}
                  />
                )}
                {/* Title */}
                <span
                  className="flex-1 truncate text-[13px]"
                  style={{ fontWeight: isActive ? 500 : 400 }}
                  title={`${title}${onRename ? " (double-click to rename)" : ""}`}
                  onDoubleClick={handleDoubleClick}
                >
                  <HighlightedTitle
                    text={title || "New Task"}
                    query={searchQuery}
                  />
                </span>
                {/* Timestamp — right-aligned, muted */}
                {timestamp && (
                  <span className="shrink-0 text-[10px] tabular-nums text-sidebar-muted-foreground/70">
                    {formatRelativeTime(timestamp)}
                  </span>
                )}
              </>
            )}
          </div>

          {/* Overflow ⋯ trigger — opens context menu at button position */}
          {!isRenaming && (
            <OverflowTrigger
              visible={showActions}
              onClick={e => {
                e.stopPropagation();
                const rect = (
                  e.currentTarget as HTMLElement
                ).getBoundingClientRect();
                setContextMenu({ x: rect.right, y: rect.bottom + 4 });
              }}
            />
          )}
        </motion.div>
      </motion.div>

      {/* Context Menu — portaled to body to escape glass-chrome stacking context */}
      {contextMenu &&
        createPortal(
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            isPinned={isPinned}
            projectId={projectId}
            projects={projects}
            onClose={() => setContextMenu(null)}
            onRename={
              onRename
                ? () => {
                    setRenameValue(title);
                    setIsRenaming(true);
                  }
                : undefined
            }
            onDelete={onDelete ? () => onDelete(id) : undefined}
            onPin={onPin ? () => onPin(id, !isPinned) : undefined}
            onCopyId={handleCopyId}
            onMoveToProject={
              onMoveToProject ? pid => onMoveToProject(id, pid) : undefined
            }
            onCreateProjectFromTask={
              onCreateProjectFromTask
                ? () => onCreateProjectFromTask(id, title)
                : undefined
            }
          />,
          document.body
        )}
    </>
  );
});

export default ConversationItem;
