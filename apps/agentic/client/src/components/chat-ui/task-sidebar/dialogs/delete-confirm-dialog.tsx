import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

export interface DeleteConfirmDialogProps {
    open: boolean;
    taskTitle: string;
    onConfirm: () => void;
    onCancel: () => void;
    isDeleting: boolean;
}

export function DeleteConfirmDialog({ open, taskTitle, onConfirm, onCancel, isDeleting }: DeleteConfirmDialogProps) {
    const cancelRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (open) cancelRef.current?.focus();
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onCancel();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [open, onCancel]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onCancel}
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 8 }}
                className="relative bg-card border border-border rounded-2xl shadow-2xl p-6 w-85 max-w-[90vw]"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="delete-dialog-title"
                aria-describedby="delete-dialog-desc"
            >
                <div className="flex items-start gap-3 mb-4">
                    <div className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-destructive/10">
                        <AlertTriangle className="w-5 h-5 text-destructive" />
                    </div>
                    <div>
                        <h3 id="delete-dialog-title" className="font-semibold text-sm text-foreground">
                            Delete task?
                        </h3>
                        <p id="delete-dialog-desc" className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            <span className="font-medium text-foreground/80">"{taskTitle}"</span> will be permanently
                            deleted. This action cannot be undone.
                        </p>
                    </div>
                </div>
                <div className="flex items-center justify-end gap-2">
                    <button
                        ref={cancelRef}
                        type="button"
                        onClick={onCancel}
                        disabled={isDeleting}
                        className="px-4 py-2 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-primary/8 hover:text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isDeleting}
                        className="px-4 py-2 text-sm font-medium rounded-lg bg-destructive text-white hover:bg-destructive/90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                    >
                        {isDeleting ? 'Deleting…' : 'Delete'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
