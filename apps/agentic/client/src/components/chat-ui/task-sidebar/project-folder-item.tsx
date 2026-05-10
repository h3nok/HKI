import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, FolderOpen, FolderClosed, Plus } from 'lucide-react';
import { ConversationItem } from './conversation-item';
import { cn } from '@/lib/utils';
import type { Task } from '../types';
import type { Project } from '../hooks/use-projects';

export interface ProjectFolderItemProps {
    project: Project;
    tasks: Task[];
    isExpanded: boolean;
    isActive: boolean;
    taskCount: number;
    isRenaming: boolean;
    renameValue: string;
    isDragOver: boolean;
    activeTaskId: string | null;
    searchQuery: string;
    projects: Project[];
    onToggleExpand: () => void;
    onContextMenu: (e: React.MouseEvent) => void;
    onDragEnter: (e: React.DragEvent) => void;
    onDragLeave: () => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
    onRenameChange: (value: string) => void;
    onRenameSubmit: () => void;
    onRenameCancel: () => void;
    onNewTask: () => void;
    onTaskDragStart: (e: React.DragEvent, taskId: string) => void;
    onTaskSelect: (id: string) => void;
    onTaskRename: (id: string, title: string) => void;
    onTaskDelete: (id: string) => void;
    onTaskPin: (id: string, isPinned: boolean) => void;
    onTaskMoveToProject: (id: string, projectId: string | null) => void;
    onTaskCreateProject: (taskId: string, taskTitle: string) => void;
}

export function ProjectFolderItem({
    project,
    tasks,
    isExpanded,
    isActive,
    taskCount,
    isRenaming,
    renameValue,
    isDragOver,
    activeTaskId,
    searchQuery,
    projects,
    onToggleExpand,
    onContextMenu,
    onDragEnter,
    onDragLeave,
    onDragOver,
    onDrop,
    onRenameChange,
    onRenameSubmit,
    onRenameCancel,
    onNewTask,
    onTaskDragStart,
    onTaskSelect,
    onTaskRename,
    onTaskDelete,
    onTaskPin,
    onTaskMoveToProject,
    onTaskCreateProject,
}: ProjectFolderItemProps) {
    return (
        <div className="relative group/folder">
            {/* Folder header */}
            <button
                type="button"
                data-active={isActive ? 'true' : 'false'}
                onClick={() => !isRenaming && onToggleExpand()}
                onContextMenu={onContextMenu}
                onDragEnter={onDragEnter}
                onDragLeave={onDragLeave}
                onDragOver={onDragOver}
                onDrop={onDrop}
                className={cn(
                    'agentic-project-folder w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all duration-200 relative overflow-hidden outline-none',
                    isDragOver
                        ? 'bg-primary/15 text-foreground ring-1 ring-primary/35 shadow-inner'
                        : isActive
                            ? 'bg-primary/10 text-primary font-semibold shadow-sm'
                            : 'text-sidebar-muted-foreground hover:text-foreground hover:bg-primary/5 border-l-transparent'
                )}
            >
                {/* Active surface accent accentuation */}
                {isActive && !isDragOver && (
                    <motion.div 
                        layoutId="active-folder-marker"
                        className="absolute left-1 top-[24%] bottom-[24%] w-[2px] bg-primary rounded-full"
                    />
                )}

                {/* Expand chevron */}
                <motion.div
                    animate={{ rotate: isExpanded ? 90 : 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="shrink-0 text-sidebar-muted-foreground/56 group-hover/folder:text-foreground/70 transition-colors"
                >
                    <ChevronRight className="w-3.5 h-3.5" />
                </motion.div>

                {/* Folder icon */}
                {isExpanded
                    ? <FolderOpen className="w-3.5 h-3.5 shrink-0 transition-all" style={{ color: project.color || 'var(--sidebar-foreground)' }} />
                    : <FolderClosed className="w-3.5 h-3.5 shrink-0 transition-all opacity-80 group-hover/folder:opacity-100" style={{ color: project.color || 'var(--sidebar-muted-foreground)' }} />
                }

                {/* Project name — inline rename or static */}
                {isRenaming ? (
                    <div className="flex-1 flex items-center z-10 relative" onClick={(e) => e.stopPropagation()}>
                        <input
                            type="text"
                            value={renameValue}
                            onChange={(e) => onRenameChange(e.target.value)}
                            onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === 'Enter') onRenameSubmit();
                                if (e.key === 'Escape') onRenameCancel();
                            }}
                            onBlur={onRenameSubmit}
                            autoFocus
                            maxLength={200}
                            className="flex-1 min-w-0 px-2 py-0.5 text-[13px] font-medium rounded-md bg-sidebar-accent border border-primary/50 shadow-sm
                                       focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground"
                        />
                    </div>
                ) : (
                    <span className="truncate flex-1 text-[12px] font-medium relative z-10">{project.name}</span>
                )}

                {/* Task count + hover add button */}
                {!isRenaming && (
                    <div className="flex items-center gap-1 shrink-0 relative z-10">
                        <AnimatePresence>
                            {taskCount > 0 && (
                                <motion.span
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    className={cn(
                                        "inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-md font-semibold text-[10px] tabular-nums transition-opacity",
                                        isActive ? "bg-primary/16 text-primary border border-primary/25" : "bg-muted/25 text-muted-foreground border border-border/20 group-hover/folder:opacity-0"
                                    )}
                                >
                                    {taskCount}
                                </motion.span>
                            )}
                        </AnimatePresence>
                        
                        <button
                            type="button"
                            className={cn(
                                "absolute right-0 items-center justify-center w-5 h-5 rounded-md transition-all",
                                "opacity-0 scale-90 pointer-events-none group-hover/folder:opacity-100 group-hover/folder:scale-100 group-hover/folder:pointer-events-auto",
                                "hover:bg-primary/16 hover:text-primary text-sidebar-muted-foreground border border-transparent hover:border-primary/25"
                            )}
                            onClick={(e) => {
                                e.stopPropagation();
                                onNewTask();
                            }}
                            title="New task in this project"
                        >
                            <Plus className="w-3 h-3 mx-auto" strokeWidth={2.5} />
                        </button>
                    </div>
                )}
            </button>

            {/* Expanded folder contents */}
            <AnimatePresence initial={false}>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                        className="overflow-hidden relative"
                    >
                        <div className="absolute left-[18px] top-0 bottom-2 w-px bg-gradient-to-b from-border/45 to-transparent pointer-events-none" />
                        
                        <div className="pl-7 my-1 space-y-1 relative pr-1.5">
                            {tasks.length === 0 ? (
                                <motion.p 
                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                    className="text-[11px] font-medium text-sidebar-muted-foreground/55 py-2.5 px-3 text-center border border-dashed border-border/25 rounded-lg bg-sidebar-accent/10"
                                >
                                    No tasks yet
                                </motion.p>
                            ) : (
                                tasks.map(task => (
                                    <motion.div
                                        key={task.id}
                                        layout
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ duration: 0.2 }}
                                        className="relative group/task"
                                    >
                                        {/* Connector pip to tree */}
                                        <div className="absolute -left-[15px] top-4 w-[11px] h-px bg-border/40 group-hover/task:bg-primary/38 transition-colors" />
                                        
                                        <div
                                            draggable
                                            onDragStart={(e) => onTaskDragStart(e, task.id)}
                                            className="cursor-move"
                                        >
                                            <ConversationItem
                                                id={task.id}
                                                title={task.description || 'New Task'}
                                                lastMessage={task.lastMessage}
                                                messageCount={task.messageCount}
                                                timestamp={new Date(task.created_at)}
                                                isActive={task.id === activeTaskId}
                                                isPinned={task.isPinned}
                                                status="idle"
                                                scope={task.scope}
                                                projectId={task.projectId}
                                                projects={projects}
                                                searchQuery={searchQuery}
                                                onSelect={onTaskSelect}
                                                onRename={onTaskRename}
                                                onDelete={onTaskDelete}
                                                onPin={onTaskPin}
                                                onMoveToProject={onTaskMoveToProject}
                                                onCreateProjectFromTask={onTaskCreateProject}
                                            />
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
