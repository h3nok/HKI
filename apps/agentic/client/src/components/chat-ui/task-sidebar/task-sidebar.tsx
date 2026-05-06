/**
 * TaskSidebar — Enterprise-Grade Agentic Conversation Sidebar
 *
 * Features:
 * - Full open/close toggle (280px expanded, completely hidden when closed)
 * - High-contrast search bar (SidebarSearch) with ⌘K, result count, dark mode support
 * - ConversationItem cards with last-message preview, message count, status, relative time
 * - ConversationGroup date-based collapsible sections (Pinned, Today, Yesterday, etc.)
 * - Delete confirmation dialog (no browser confirm())
 * - Mobile overlay with backdrop + swipe-to-close
 * - Escape key closes sidebar, ⌘K focuses search
 * - Keyboard-accessible conversation list
 * - User footer with avatar, settings, logout
 *
 * @module task-sidebar/task-sidebar
 */

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { Trash2, MessageSquareDashed } from "lucide-react";

import { DeleteConfirmDialog } from "./dialogs";
import { ClearAllDialog } from "./dialogs";
import { UserFooter } from "./user-footer";
import { ProjectFolderItem } from "./project-folder-item";
import {
  FolderContextMenu,
  type FolderContextMenuState,
} from "./folder-context-menu";
import { SidebarRail } from "./sidebar-rail";
import { toast } from "sonner";
import { SettingsModal } from "../settings/settings-modal";
import { SidebarHeader } from "./sidebar-header";
import { SearchOverlay } from "./search-overlay";
import { ConversationItem } from "./conversation-item";
import {
  ConversationGroup,
  getDateCategory,
  DATE_CATEGORY_LABELS,
  type DateCategory,
} from "./conversation-group";
// ProjectList replaced by inline folder rendering
import { CreateProjectModal } from "./create-project-modal";
import {
  useTasks,
  useDeleteTask,
  useRenameTask,
  usePinTask,
} from "../hooks/use-tasks";
import {
  useProjects,
  useCreateProject,
  useRenameProject,
  useDeleteProject,
  useMoveConversation,
} from "../hooks/use-projects";
import {
  useSafeSearchParams,
  SearchParamKey,
} from "../hooks/use-search-params";
import { buildChatWorkspaceHref } from "@/_core/workspace-navigation";
import { TYPOGRAPHY, SPACING, MOTION, LAYOUT } from "@/design-system/tokens";
import { cn } from "@/lib/utils";
import type { Task } from "../types";

// ============================================================================
// TYPES
// ============================================================================

export interface TaskSidebarProps {
  userId: number;
  isOpen: boolean;
  onClose: () => void;
  /** Toggle sidebar open/closed — used by ⌘B keyboard shortcut */
  onToggle?: () => void;
  /** Optional override for selecting a conversation from the list */
  onSelectTask?: (task: Task) => void;
  /** Notifies parent when the active project filter changes (null = all tasks) */
  onActiveProjectChange?: (projectId: string | null) => void;
  /** Active domain name for the sidebar badge */
  activeStreamName?: string;
  /** Active domain icon */
  activeStreamIcon?: string;
  /** Active domain ID for scoped workspace navigation */
  activeScopeId?: string;
  /** Whether the chat is locked to a URL-scoped domain */
  isScopeLocked?: boolean;
  /** WebSocket connection status — undefined when no active task */
  isConnected?: boolean;
  /** Whether the clear-all affordance should be visible */
  showClearAllAction?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SIDEBAR_WIDTH = 320;
const MOBILE_BREAKPOINT = 768;
const SIDEBAR_KEYBOARD_SHORTCUT = "b";

const DATE_ORDER: DateCategory[] = [
  "pinned",
  "today",
  "yesterday",
  "previous7days",
  "previous30days",
  "older",
];

// ============================================================================
// HELPERS
// ============================================================================

/** Group tasks by date category using shared helpers from ConversationGroup */
function groupByDate(tasks: Task[]): Map<DateCategory, Task[]> {
  const groups = new Map<DateCategory, Task[]>();
  DATE_ORDER.forEach(cat => groups.set(cat, []));

  tasks.forEach(task => {
    const cat = getDateCategory(new Date(task.created_at), task.isPinned);
    groups.get(cat)?.push(task);
  });

  // Remove empty groups
  DATE_ORDER.forEach(cat => {
    if (groups.get(cat)?.length === 0) groups.delete(cat);
  });

  return groups;
}

// ============================================================================
// SKELETON LOADING — Conversation list placeholder
// ============================================================================

function ConversationListSkeleton() {
  return (
    <div className="flex flex-col gap-1 pt-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 p-3 rounded-xl">
          <div className="w-8 h-8 rounded-lg bg-sidebar-accent/50 animate-pulse" />
          <div className="flex-1 space-y-2.5 mt-0.5">
            <div
              className="h-2 rounded bg-sidebar-accent/40 animate-pulse"
              style={{ width: `${65 + ((i * 7) % 30)}%` }}
            />
            <div className="h-1.5 rounded bg-sidebar-accent/20 w-4/5 animate-pulse" />
            <div className="h-1.5 rounded bg-sidebar-accent/10 w-2/5 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// EMPTY STATE — No conversations / no search results
// ============================================================================

function EmptyState({
  hasSearchQuery,
  query,
}: {
  hasSearchQuery: boolean;
  query: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center pt-24 px-4 flex flex-col items-center justify-center"
    >
      <div className="relative flex h-20 w-20 items-center justify-center mb-6 mix-blend-plus-lighter">
        {hasSearchQuery ? (
          <MessageSquareDashed className="w-8 h-8 text-sidebar-muted-foreground/60 relative z-10" />
        ) : (
          <>
            <motion.div
              animate={{ scale: [1, 1.4, 1], opacity: [0.1, 0.3, 0.1] }}
              transition={{ duration: 4, ease: "easeInOut", repeat: Infinity }}
              className="absolute inset-0 bg-primary/40 rounded-full blur-2xl"
            />
            <div className="absolute inset-3 bg-primary/10 rounded-full border border-primary/20 backdrop-blur-sm" />
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              className="text-primary/90 relative z-10 drop-shadow-md"
              style={{ strokeLinecap: "round", strokeLinejoin: "round" }}
            >
              <rect
                x="3"
                y="3"
                width="7"
                height="7"
                rx="2.5"
                stroke="currentColor"
                strokeWidth="2.5"
              />
              <rect
                x="14"
                y="3"
                width="7"
                height="7"
                rx="2.5"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeDasharray="3 4"
              />
              <rect
                x="3"
                y="14"
                width="7"
                height="7"
                rx="2.5"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeDasharray="3 4"
              />
              <rect
                x="14"
                y="14"
                width="7"
                height="7"
                rx="2.5"
                stroke="currentColor"
                strokeWidth="2.5"
              />
            </svg>
          </>
        )}
      </div>
      <p className="font-extrabold text-[12px] tracking-widest uppercase text-sidebar-foreground/80 mb-2">
        {hasSearchQuery ? "No matches found" : "Systems Standby"}
      </p>
      <p className="text-[11px] font-medium text-sidebar-muted-foreground/60 leading-relaxed max-w-50 mx-auto tracking-wide">
        {hasSearchQuery
          ? `No tasks matching "${query}"`
          : "Agent initialized. Awaiting operational parameters."}
      </p>
    </motion.div>
  );
}

// ============================================================================
// MAIN SIDEBAR COMPONENT
// ============================================================================

export function TaskSidebar({
  userId,
  isOpen,
  onClose,
  onToggle,
  onSelectTask,
  onActiveProjectChange,
  activeStreamName,
  activeStreamIcon,
  activeScopeId,
  isScopeLocked = false,
  isConnected,
  showClearAllAction = true,
}: TaskSidebarProps) {
  const { taskID, updateParams } = useSafeSearchParams();
  const { data: tasks, isLoading } = useTasks(userId);
  const { deleteTask, isLoading: isDeleting } = useDeleteTask(userId);
  const { renameTask } = useRenameTask(userId);
  const { pinTask } = usePinTask(userId);

  // Project hooks
  const { data: projects } = useProjects();
  const { createProject } = useCreateProject();
  const { renameProject } = useRenameProject();
  const { deleteProject } = useDeleteProject();
  const { moveConversation } = useMoveConversation();
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [createProjectInitialName, setCreateProjectInitialName] = useState("");
  const homeHref = useMemo(
    () => buildChatWorkspaceHref(activeScopeId),
    [activeScopeId]
  );
  const [pendingMoveTaskId, setPendingMoveTaskId] = useState<string | null>(
    null
  );

  // Notify parent whenever active project changes (so new tasks inherit the scope)
  useEffect(() => {
    onActiveProjectChange?.(activeProjectId);
  }, [activeProjectId, onActiveProjectChange]);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [showClearAll, setShowClearAll] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLDivElement>(null);
  const [scrollShadow, setScrollShadow] = useState<
    "none" | "top" | "bottom" | "both"
  >("none");

  useEffect(() => {
    if (!showClearAllAction) {
      setShowClearAll(false);
    }
  }, [showClearAllAction]);

  // ── Tasks (overlay handles its own search filtering) ──
  const filteredTasks = tasks;

  // Derive the active project object for UI context (NewTaskButton, breadcrumbs)
  const activeProject = useMemo(() => {
    if (!activeProjectId || !projects) return null;
    return projects.find(p => p.id === activeProjectId) ?? null;
  }, [activeProjectId, projects]);

  const grouped = useMemo(() => groupByDate(filteredTasks), [filteredTasks]);

  // Task counts per project (for badges on project list)
  const taskCountsByProject = useMemo(() => {
    const counts = new Map<string, number>();
    for (const task of tasks) {
      if (task.projectId) {
        counts.set(task.projectId, (counts.get(task.projectId) || 0) + 1);
      }
    }
    return counts;
  }, [tasks]);

  // Tasks grouped by project for folder view
  const tasksByProject = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of filteredTasks) {
      if (task.projectId) {
        const arr = map.get(task.projectId) || [];
        arr.push(task);
        map.set(task.projectId, arr);
      }
    }
    return map;
  }, [filteredTasks]);

  // Tasks with no project (shown below folders)
  const unassignedTasks = useMemo(
    () => filteredTasks.filter(t => !t.projectId),
    [filteredTasks]
  );

  const unassignedGrouped = useMemo(
    () => groupByDate(unassignedTasks),
    [unassignedTasks]
  );

  // Track which project folders are expanded
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    new Set()
  );

  // Drag-and-drop: track which folder is being dragged over
  const [dragOverProjectId, setDragOverProjectId] = useState<string | null>(
    null
  );
  const dragCounter = useRef(0);

  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleFolderDragEnter = useCallback(
    (e: React.DragEvent, projectId: string) => {
      e.preventDefault();
      dragCounter.current++;
      setDragOverProjectId(projectId);
    },
    []
  );

  const handleFolderDragLeave = useCallback(() => {
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setDragOverProjectId(null);
    }
  }, []);

  const handleFolderDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleFolderDrop = useCallback(
    async (e: React.DragEvent, projectId: string | null) => {
      e.preventDefault();
      dragCounter.current = 0;
      setDragOverProjectId(null);
      const taskId = e.dataTransfer.getData("text/plain");
      if (!taskId) return;
      try {
        await moveConversation(taskId, projectId);
        const project = projects.find(p => p.id === projectId);
        toast.success(
          projectId
            ? `Moved to ${project?.name ?? "project"}`
            : "Removed from project"
        );
      } catch {
        toast.error("Failed to move task");
      }
    },
    [moveConversation, projects]
  );
  const toggleProjectExpanded = useCallback(
    (projectId: string) => {
      setExpandedProjects(prev => {
        const next = new Set(prev);
        if (next.has(projectId)) {
          next.delete(projectId);
          if (activeProjectId === projectId) setActiveProjectId(null);
        } else {
          next.add(projectId);
          setActiveProjectId(projectId); // expanding a folder sets it as active for new tasks
        }
        return next;
      });
    },
    [activeProjectId]
  );

  // ── Folder context menu (right-click → Rename / Delete) ──
  const [folderContextMenu, setFolderContextMenu] =
    useState<FolderContextMenuState | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [folderRenameValue, setFolderRenameValue] = useState("");

  const handleFolderRename = useCallback(
    async (projectId: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) {
        setRenamingFolderId(null);
        return;
      }
      try {
        await renameProject(projectId, trimmed);
        toast.success("Project renamed");
      } catch {
        toast.error("Failed to rename project");
      }
      setRenamingFolderId(null);
    },
    [renameProject]
  );

  const handleFolderDelete = useCallback(
    async (projectId: string) => {
      try {
        await deleteProject(projectId);
        if (activeProjectId === projectId) setActiveProjectId(null);
        expandedProjects.delete(projectId);
        setExpandedProjects(new Set(expandedProjects));
        toast.success("Project deleted");
      } catch {
        toast.error("Failed to delete project");
      }
    },
    [deleteProject, activeProjectId, expandedProjects]
  );

  // ── Scroll to active conversation on sidebar open ──
  useEffect(() => {
    if (!isOpen || !taskID || isLoading) return;
    // Wait for DOM update
    const timer = setTimeout(() => {
      const el = scrollContainerRef.current;
      if (!el) return;
      const activeEl = el.querySelector('[aria-current="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [isOpen, taskID, isLoading]);

  // ── Scroll shadow detection ──
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const update = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const atTop = scrollTop < 4;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 4;
      if (atTop && atBottom) setScrollShadow("none");
      else if (atTop) setScrollShadow("bottom");
      else if (atBottom) setScrollShadow("top");
      else setScrollShadow("both");
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    return () => el.removeEventListener("scroll", update);
  }, [filteredTasks.length]);

  // ── Mobile detection ──
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── ⌘B / Ctrl+B keyboard shortcut to toggle sidebar (works when open or closed) ──
  useEffect(() => {
    if (!onToggle) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === SIDEBAR_KEYBOARD_SHORTCUT && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onToggle();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onToggle]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (deleteTarget || showClearAll) return;
        if (showSearch) {
          setShowSearch(false);
          return;
        }
        onClose();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        e.stopPropagation(); // Prevent global ⌘K (new chat) from also firing
        setShowSearch(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose, deleteTarget, showClearAll, showSearch]);

  // ── Handlers ──
  const handleNewChat = useCallback(() => {
    updateParams({ [SearchParamKey.TASK_ID]: null });
  }, [updateParams]);

  const handleSelectTask = useCallback(
    (id: string) => {
      const task = tasks.find(t => t.id === id);
      if (task && onSelectTask) {
        onSelectTask(task);
      } else {
        updateParams({ [SearchParamKey.TASK_ID]: id });
      }
      if (isMobile) onClose();
    },
    [tasks, onSelectTask, updateParams, isMobile, onClose]
  );

  const handleDeleteRequest = useCallback(
    (id: string) => {
      const task = tasks.find(t => t.id === id);
      setDeleteTarget({ id, title: task?.description || "New Task" });
    },
    [tasks]
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteTask(deleteTarget.id);
      toast.success("Task deleted");
      if (deleteTarget.id === taskID) {
        updateParams({ [SearchParamKey.TASK_ID]: null });
      }
    } catch (err) {
      console.error("[Delete] Failed to delete task:", deleteTarget.id, err);
      toast.error("Failed to delete");
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, deleteTask, taskID, updateParams]);

  const handleClearAll = useCallback(async () => {
    setIsClearingAll(true);
    try {
      let failed = 0;
      for (const task of tasks) {
        try {
          await deleteTask(task.id);
        } catch {
          failed++;
        }
      }
      updateParams({ [SearchParamKey.TASK_ID]: null });
      if (failed > 0) {
        toast.warning(
          `Cleared tasks with ${failed} error${failed > 1 ? "s" : ""}`
        );
      } else {
        toast.success(
          `Cleared ${tasks.length} task${tasks.length !== 1 ? "s" : ""}`
        );
      }
    } catch {
      toast.error("Failed to clear tasks");
    } finally {
      setIsClearingAll(false);
      setShowClearAll(false);
    }
  }, [tasks, deleteTask, updateParams]);

  const handleRename = useCallback(
    async (id: string, newTitle: string) => {
      try {
        await renameTask(id, newTitle);
        toast.success("Task renamed");
      } catch {
        toast.error("Failed to rename");
      }
    },
    [renameTask]
  );

  const handlePin = useCallback(
    async (id: string, isPinned: boolean) => {
      try {
        await pinTask(id, isPinned);
        toast.success(isPinned ? "Task pinned" : "Task unpinned");
      } catch {
        toast.error("Failed to update pin");
      }
    },
    [pinTask]
  );

  const handleMoveToProject = useCallback(
    async (conversationId: string, projectId: string | null) => {
      try {
        await moveConversation(conversationId, projectId);
        const project = projects.find(p => p.id === projectId);
        toast.success(
          projectId
            ? `Moved to ${project?.emoji ?? ""} ${project?.name ?? "project"}`
            : "Removed from project"
        );
      } catch {
        toast.error("Failed to move task");
      }
    },
    [moveConversation, projects]
  );

  const handleCreateProject = useCallback(
    async (params: { name: string; emoji?: string; color?: string }) => {
      try {
        const result = await createProject(params);
        toast.success("Project created");
        // Auto-expand the newly created folder
        if (result?.id) {
          setExpandedProjects(
            prev => new Set(Array.from(prev).concat(result.id))
          );
          setActiveProjectId(result.id);
        }
        // If a task was pending to be moved into this new project, do it now
        if (pendingMoveTaskId && result?.id) {
          try {
            await moveConversation(pendingMoveTaskId, result.id);
            toast.success(
              `Task added to ${params.emoji ?? "📁"} ${params.name}`
            );
          } catch {
            // Project created but move failed — not critical
          }
        }
        setPendingMoveTaskId(null);
      } catch {
        toast.error("Failed to create project");
        setPendingMoveTaskId(null);
        throw new Error("create failed"); // re-throw so modal knows
      }
    },
    [createProject, pendingMoveTaskId, moveConversation]
  );

  /** Open the create-project modal pre-filled with a suggested name, and queue the task to move after creation */
  const handleCreateProjectFromTask = useCallback(
    (taskId: string, taskTitle: string) => {
      // Generate a smart suggested name from the task title or timestamp
      const now = new Date();
      const dateStr = now.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      const cleanTitle = (taskTitle || "").replace(/^New Task$/i, "").trim();
      const suggestedName = cleanTitle
        ? cleanTitle.length > 40
          ? `${cleanTitle.substring(0, 37)}...`
          : cleanTitle
        : `${dateStr} Research`;
      setCreateProjectInitialName(suggestedName);
      setPendingMoveTaskId(taskId);
      setShowCreateProject(true);
    },
    []
  );

  return (
    <>
      {/* Mobile overlay backdrop */}
      <AnimatePresence>
        {isOpen && isMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
            onClick={onClose}
            aria-hidden
          />
        )}
      </AnimatePresence>

      {/* Delete confirmation dialog */}
      <DeleteConfirmDialog
        open={!!deleteTarget}
        taskTitle={deleteTarget?.title || ""}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        isDeleting={isDeleting}
      />

      {/* Create Project modal */}
      <CreateProjectModal
        open={showCreateProject}
        onClose={() => {
          setShowCreateProject(false);
          setPendingMoveTaskId(null);
          setCreateProjectInitialName("");
        }}
        onSubmit={handleCreateProject}
        initialName={createProjectInitialName}
      />

      {/* Clear All confirmation dialog */}
      <ClearAllDialog
        open={showClearAll}
        count={tasks.length}
        onConfirm={handleClearAll}
        onCancel={() => setShowClearAll(false)}
        isClearing={isClearingAll}
      />

      {/* Sidebar Rail — shows on left edge when sidebar is closed (desktop only) */}
      {!isOpen && !isMobile && onToggle && (
        <div className="relative h-full w-0 shrink-0 z-20">
          <button
            type="button"
            aria-label="Open Sidebar"
            tabIndex={-1}
            onClick={onToggle}
            title="Open Sidebar (⌘B)"
            className="absolute inset-y-0 left-0 w-3 z-30 cursor-e-resize"
          />
        </div>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: SIDEBAR_WIDTH, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            role="navigation"
            aria-label="Tasks"
            className={cn(
              "agentic-task-sidebar flex flex-col h-full shrink-0 overflow-hidden bg-sidebar/90 backdrop-blur-3xl border-r border-border/50",
              isMobile
                ? "fixed inset-y-0 left-0 z-40 shadow-2xl"
                : "relative z-20 shadow-lg"
            )}
          >
            {/* Sidebar Rail — invisible edge strip for hover/click toggle */}
            {!isMobile && onToggle && (
              <SidebarRail isOpen={isOpen} onToggle={onToggle} />
            )}

            {/* ── Modular header: brand + actions + search ── */}
            <SidebarHeader
              onNewTask={handleNewChat}
              onNewProject={() => {
                setCreateProjectInitialName("");
                setShowCreateProject(true);
              }}
              onClose={onClose}
              isMobile={isMobile}
              onOpenSearch={() => setShowSearch(true)}
              homeHref={homeHref}
              activeStreamName={activeStreamName}
              activeStreamIcon={activeStreamIcon}
            />

            {/* ═══════════════════════════════════════════════════════════
                            TASK LIST — Project folders + Unassigned tasks
                        ═══════════════════════════════════════════════════════════ */}
            <div className="flex-1 relative overflow-hidden">
              {/* Top scroll shadow */}
              {(scrollShadow === "top" || scrollShadow === "both") && (
                <div
                  className="absolute top-0 left-0 right-0 h-6 z-10 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(to bottom, var(--sidebar), transparent)",
                  }}
                />
              )}
              {/* Bottom scroll shadow */}
              {(scrollShadow === "bottom" || scrollShadow === "both") && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-6 z-10 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(to top, var(--sidebar), transparent)",
                  }}
                />
              )}

              <div
                ref={scrollContainerRef}
                className="h-full overflow-y-auto px-2 pb-2"
              >
                {isLoading ? (
                  <ConversationListSkeleton />
                ) : filteredTasks.length === 0 && projects.length === 0 ? (
                  <EmptyState hasSearchQuery={false} query="" />
                ) : (
                  <div className="space-y-1">
                    {/* ── Project Folders ── */}
                    {projects.map(project => (
                      <ProjectFolderItem
                        key={project.id}
                        project={project}
                        tasks={tasksByProject.get(project.id) || []}
                        isExpanded={expandedProjects.has(project.id)}
                        isActive={activeProjectId === project.id}
                        taskCount={taskCountsByProject.get(project.id) || 0}
                        isRenaming={renamingFolderId === project.id}
                        renameValue={folderRenameValue}
                        isDragOver={dragOverProjectId === project.id}
                        activeTaskId={taskID}
                        searchQuery=""
                        projects={projects}
                        onToggleExpand={() => toggleProjectExpanded(project.id)}
                        onContextMenu={e => {
                          e.preventDefault();
                          setFolderContextMenu({
                            projectId: project.id,
                            x: e.clientX,
                            y: e.clientY,
                          });
                        }}
                        onDragEnter={e => handleFolderDragEnter(e, project.id)}
                        onDragLeave={handleFolderDragLeave}
                        onDragOver={handleFolderDragOver}
                        onDrop={e => handleFolderDrop(e, project.id)}
                        onRenameChange={setFolderRenameValue}
                        onRenameSubmit={() =>
                          handleFolderRename(project.id, folderRenameValue)
                        }
                        onRenameCancel={() => setRenamingFolderId(null)}
                        onNewTask={() => {
                          setActiveProjectId(project.id);
                          if (!expandedProjects.has(project.id))
                            toggleProjectExpanded(project.id);
                          handleNewChat();
                        }}
                        onTaskDragStart={handleDragStart}
                        onTaskSelect={handleSelectTask}
                        onTaskRename={handleRename}
                        onTaskDelete={handleDeleteRequest}
                        onTaskPin={handlePin}
                        onTaskMoveToProject={handleMoveToProject}
                        onTaskCreateProject={handleCreateProjectFromTask}
                      />
                    ))}

                    {/* ── Unassigned Tasks (no project) ── */}
                    {unassignedTasks.length > 0 && (
                      <>
                        {projects.length > 0 && (
                          <div
                            className={`pt-2 pb-1 px-2 flex items-center justify-between rounded-lg transition-colors
                                                                    ${dragOverProjectId === "__unassigned__" ? "bg-sidebar-primary/10 ring-1 ring-sidebar-primary/30" : ""}`}
                            onDragEnter={e =>
                              handleFolderDragEnter(e, "__unassigned__")
                            }
                            onDragLeave={handleFolderDragLeave}
                            onDragOver={handleFolderDragOver}
                            onDrop={e => handleFolderDrop(e, null)}
                          >
                            <span className="font-medium uppercase tracking-widest text-[10px] text-sidebar-muted-foreground">
                              Unassigned
                            </span>
                            <span className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[9px] text-primary/60 bg-primary/8">
                              {unassignedTasks.length}
                            </span>
                          </div>
                        )}
                        {Array.from(unassignedGrouped.entries()).map(
                          ([category, categoryTasks]) => (
                            <ConversationGroup
                              key={category}
                              label={DATE_CATEGORY_LABELS[category]}
                              count={categoryTasks.length}
                              defaultExpanded={
                                category === "pinned" ||
                                category === "today" ||
                                category === "yesterday"
                              }
                            >
                              <AnimatePresence initial={false}>
                                {categoryTasks.map(task => (
                                  <motion.div
                                    key={task.id}
                                    layout
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{
                                      opacity: 0,
                                      height: 0,
                                      marginBottom: 0,
                                    }}
                                    transition={{
                                      duration: 0.2,
                                      ease: [0.4, 0, 0.2, 1],
                                    }}
                                  >
                                    <div
                                      draggable
                                      onDragStart={e =>
                                        handleDragStart(e, task.id)
                                      }
                                    >
                                      <ConversationItem
                                        id={task.id}
                                        title={task.description || "New Task"}
                                        lastMessage={task.lastMessage}
                                        messageCount={task.messageCount}
                                        timestamp={new Date(task.created_at)}
                                        isActive={task.id === taskID}
                                        isPinned={task.isPinned}
                                        status="idle"
                                        scope={task.scope}
                                        projectId={task.projectId}
                                        projects={projects}
                                        searchQuery=""
                                        onSelect={handleSelectTask}
                                        onRename={handleRename}
                                        onDelete={handleDeleteRequest}
                                        onPin={handlePin}
                                        onMoveToProject={handleMoveToProject}
                                        onCreateProjectFromTask={
                                          handleCreateProjectFromTask
                                        }
                                      />
                                    </div>
                                  </motion.div>
                                ))}
                              </AnimatePresence>
                            </ConversationGroup>
                          )
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════
                            USER FOOTER
                        ═══════════════════════════════════════════════════════════ */}
            {/* Clear All button above footer */}
            {showClearAllAction && tasks.length > 0 && (
              <div className="px-3 pb-1">
                <button
                  type="button"
                  onClick={() => setShowClearAll(true)}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium
                                               text-sidebar-muted-foreground hover:text-destructive
                                               hover:bg-destructive/8 transition-all duration-200
                                               border border-transparent hover:border-destructive/20"
                  title="Delete all tasks"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear all tasks
                </button>
              </div>
            )}
            <UserFooter
              onOpenSettings={() => setIsSettingsOpen(true)}
              isScopeLocked={isScopeLocked}
              isConnected={isConnected}
            />
            <SettingsModal
              open={isSettingsOpen}
              onOpenChange={setIsSettingsOpen}
            />

            {/* ── Folder context menu (Rename / Delete) ── */}
            <FolderContextMenu
              menu={folderContextMenu}
              onClose={() => setFolderContextMenu(null)}
              onRename={projectId => {
                const p = projects.find(p => p.id === projectId);
                if (p) {
                  setFolderRenameValue(p.name);
                  setRenamingFolderId(p.id);
                }
              }}
              onDelete={handleFolderDelete}
            />

            {/* ── Search command palette (⌘K) ── */}
            <SearchOverlay
              open={showSearch}
              onClose={() => setShowSearch(false)}
              tasks={tasks}
              onSelect={handleSelectTask}
            />
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
