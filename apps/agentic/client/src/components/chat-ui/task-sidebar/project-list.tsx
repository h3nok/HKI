/**
 * ProjectList — Collapsible project folders in the sidebar
 *
 * Features:
 * - Collapsible "Projects" section with count badge
 * - Each project: emoji + name, click to filter tasks
 * - "New project" button opens CreateProjectModal (via callback)
 * - Right-click context menu: rename, delete
 * - Active project indicator with color accent
 *
 * @module task-sidebar/project-list
 */

import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronDown,
    Plus,
    FolderPlus,
    Pencil,
    Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Project } from '../hooks/use-projects';

// ============================================================================
// TYPES
// ============================================================================

export interface ProjectListProps {
    projects: Project[];
    activeProjectId: string | null;
    /** Task count per project ID — shown as badge */
    taskCounts?: Map<string, number>;
    onSelectProject: (projectId: string | null) => void;
    onOpenCreateModal: () => void;
    onRenameProject: (projectId: string, name: string) => Promise<any>;
    onDeleteProject: (projectId: string) => Promise<any>;
}

// ============================================================================
// PROJECT ITEM
// ============================================================================

interface ProjectItemProps {
    project: Project;
    isActive: boolean;
    taskCount?: number;
    onSelect: () => void;
    onRename: (name: string) => void;
    onDelete: () => void;
}

const ProjectItem = memo(function ProjectItem({
    project,
    isActive,
    taskCount,
    onSelect,
    onRename,
    onDelete,
}: ProjectItemProps) {
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState(project.name);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const handleConfirmRename = useCallback(() => {
        const trimmed = renameValue.trim();
        if (trimmed && trimmed !== project.name) {
            onRename(trimmed);
        }
        setIsRenaming(false);
    }, [renameValue, project.name, onRename]);

    // Close context menu on outside click / Escape
    useEffect(() => {
        if (!contextMenu) return;
        const handler = (e: MouseEvent | KeyboardEvent) => {
            if (e instanceof KeyboardEvent && e.key === 'Escape') { setContextMenu(null); return; }
            if (e instanceof MouseEvent && menuRef.current && !menuRef.current.contains(e.target as Node)) setContextMenu(null);
        };
        document.addEventListener('mousedown', handler);
        document.addEventListener('keydown', handler);
        return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('keydown', handler); };
    }, [contextMenu]);

    return (
        <>
            <button
                type="button"
                onClick={isRenaming ? undefined : onSelect}
                onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY }); }}
                className={`
                    w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs
                    transition-all duration-150 group
                    ${isActive
                        ? 'bg-sidebar-accent text-sidebar-foreground font-medium'
                        : 'text-sidebar-muted-foreground hover:text-primary hover:bg-primary/8'
                    }
                `}
                style={isActive && project.color ? { borderLeft: `2px solid ${project.color}` } : undefined}
            >
                <span className="shrink-0 text-sm leading-none">{project.emoji}</span>
                {isRenaming ? (
                    <div className="flex-1 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <input
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === 'Enter') handleConfirmRename();
                                if (e.key === 'Escape') setIsRenaming(false);
                            }}
                            onBlur={handleConfirmRename}
                            autoFocus
                            maxLength={200}
                            className="flex-1 min-w-0 px-1 py-0 text-xs rounded bg-sidebar-accent border border-sidebar-primary/40
                                       focus:outline-none focus:ring-1 focus:ring-sidebar-primary/50 text-sidebar-foreground"
                        />
                    </div>
                ) : (
                    <span className="truncate flex-1">{project.name}</span>
                )}
                {/* Task count badge */}
                {!isRenaming && taskCount != null && taskCount > 0 && (
                    <span
                        className="shrink-0 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-sidebar-muted-foreground/60"
                        style={{ fontSize: 9, background: 'color-mix(in srgb, var(--sidebar-foreground) 8%, transparent)' }}
                    >
                        {taskCount}
                    </span>
                )}
            </button>

            {/* Context menu */}
            {contextMenu && (
                <motion.div
                    ref={menuRef}
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.92 }}
                    transition={{ duration: 0.12 }}
                    style={{
                        position: 'fixed',
                        left: Math.min(contextMenu.x, window.innerWidth - 160),
                        top: Math.min(contextMenu.y, window.innerHeight - 120),
                        zIndex: 9999,
                    }}
                    className="bg-popover border border-border rounded-xl shadow-xl p-1 min-w-36"
                    role="menu"
                >
                    <button
                        type="button"
                        onClick={() => { setRenameValue(project.name); setIsRenaming(true); setContextMenu(null); }}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium rounded-md transition-colors
                                   text-foreground/80 hover:bg-primary/8 hover:text-primary"
                        role="menuitem"
                    >
                        <Pencil className="w-3.5 h-3.5" />
                        Rename
                    </button>
                    <div className="my-1 h-px bg-border" />
                    <button
                        type="button"
                        onClick={() => { onDelete(); setContextMenu(null); }}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium rounded-md transition-colors
                                   text-destructive hover:bg-destructive/10"
                        role="menuitem"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete project
                    </button>
                </motion.div>
            )}
        </>
    );
});

// ============================================================================
// MAIN PROJECT LIST
// ============================================================================

export const ProjectList = memo(function ProjectList({
    projects,
    activeProjectId,
    taskCounts,
    onSelectProject,
    onOpenCreateModal,
    onRenameProject,
    onDeleteProject,
}: ProjectListProps) {
    const [isExpanded, setIsExpanded] = useState(true);

    const handleRename = useCallback(
        async (projectId: string, name: string) => {
            try {
                await onRenameProject(projectId, name);
                toast.success('Project renamed');
            } catch {
                toast.error('Failed to rename project');
            }
        },
        [onRenameProject]
    );

    const handleDelete = useCallback(
        async (projectId: string) => {
            try {
                await onDeleteProject(projectId);
                if (activeProjectId === projectId) onSelectProject(null);
                toast.success('Project deleted');
            } catch {
                toast.error('Failed to delete project');
            }
        },
        [onDeleteProject, activeProjectId, onSelectProject]
    );

    return (
        <div className="mb-1">
            {/* Section header */}
            <div className="flex items-center justify-between px-2 py-1">
                <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center gap-1 text-sidebar-muted-foreground hover:text-sidebar-foreground transition-colors"
                >
                    <motion.div
                        animate={{ rotate: isExpanded ? 0 : -90 }}
                        transition={{ duration: 0.15 }}
                    >
                        <ChevronDown className="w-3 h-3" />
                    </motion.div>
                    <span className="font-medium uppercase tracking-wide" style={{ fontSize: 10, letterSpacing: '0.1em' }}>
                        Projects
                    </span>
                    {projects.length > 0 && (
                        <span className="text-sidebar-muted-foreground/60 ml-1" style={{ fontSize: 10 }}>
                            {projects.length}
                        </span>
                    )}
                </button>
                <button
                    type="button"
                    onClick={() => { setIsExpanded(true); onOpenCreateModal(); }}
                    className="p-1 rounded-md text-sidebar-muted-foreground hover:text-primary hover:bg-primary/8 transition-colors"
                    title="New project"
                    aria-label="Create new project"
                >
                    <Plus className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Content */}
            <AnimatePresence initial={false}>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                        className="overflow-hidden"
                    >
                        <div className="flex flex-col gap-0.5 pt-0.5">
                            {/* Project items */}
                            <AnimatePresence initial={false}>
                                {projects.map((project) => (
                                    <motion.div
                                        key={project.id}
                                        layout
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.15 }}
                                    >
                                        <ProjectItem
                                            project={project}
                                            isActive={activeProjectId === project.id}
                                            taskCount={taskCounts?.get(project.id)}
                                            onSelect={() => onSelectProject(project.id)}
                                            onRename={(name) => handleRename(project.id, name)}
                                            onDelete={() => handleDelete(project.id)}
                                        />
                                    </motion.div>
                                ))}
                            </AnimatePresence>

                            {/* Empty state */}
                            {projects.length === 0 && (
                                <button
                                    type="button"
                                    onClick={onOpenCreateModal}
                                    className="flex items-center gap-2 px-2 py-2 rounded-lg text-xs
                                               text-sidebar-muted-foreground/60 hover:text-sidebar-foreground
                                               hover:bg-primary/8 transition-colors"
                                >
                                    <FolderPlus className="w-3.5 h-3.5" />
                                    Create your first project
                                </button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
});

export default ProjectList;
