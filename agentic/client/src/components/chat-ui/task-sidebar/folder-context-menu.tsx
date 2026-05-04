import { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, Trash2 } from 'lucide-react';

export interface FolderContextMenuState {
    projectId: string;
    x: number;
    y: number;
}

export interface FolderContextMenuProps {
    menu: FolderContextMenuState | null;
    onClose: () => void;
    onRename: (projectId: string) => void;
    onDelete: (projectId: string) => void;
}

export function FolderContextMenu({ menu, onClose, onRename, onDelete }: FolderContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!menu) return;
        const handler = (e: MouseEvent | KeyboardEvent) => {
            if (e instanceof KeyboardEvent && e.key === 'Escape') {
                onClose();
                return;
            }
            if (e instanceof MouseEvent && menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handler);
        document.addEventListener('keydown', handler);
        return () => {
            document.removeEventListener('mousedown', handler);
            document.removeEventListener('keydown', handler);
        };
    }, [menu, onClose]);

    return createPortal(
        <AnimatePresence>
            {menu && (
                <motion.div
                    ref={menuRef}
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.92 }}
                    transition={{ duration: 0.12 }}
                    style={{
                        position: 'fixed',
                        left: Math.min(menu.x, window.innerWidth - 170),
                        top: Math.min(menu.y, window.innerHeight - 130),
                        zIndex: 9999,
                    }}
                    className="bg-popover border border-border rounded-xl shadow-xl p-1 min-w-40"
                    role="menu"
                >
                    <button
                        type="button"
                        onClick={() => {
                            onRename(menu.projectId);
                            onClose();
                        }}
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
                        onClick={() => {
                            onDelete(menu.projectId);
                            onClose();
                        }}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium rounded-md transition-colors
                                   text-destructive hover:bg-destructive/10"
                        role="menuitem"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete project
                    </button>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body,
    );
}
