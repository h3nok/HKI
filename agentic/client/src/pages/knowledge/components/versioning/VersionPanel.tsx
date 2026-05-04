import { useState } from 'react';
import { GitCommitVertical, Loader2, History } from 'lucide-react';
import { cn, useNotifications } from '@hki/ui';
import { trpc } from '@/lib/trpc';
import { cardCls } from '../../types';
import { k } from '../../theme';
import VersionTimeline from './VersionTimeline';
import DiffViewer from './DiffViewer';
import type { DocumentVersion, DiffResponse } from '@shared/knowledge-types';

interface VersionPanelProps {
  sourceRef: string;
}

export default function VersionPanel({ sourceRef }: VersionPanelProps) {
  const [selectedVersion, setSelectedVersion] = useState<DocumentVersion | null>(null);
  const [diff, setDiff] = useState<DiffResponse | null>(null);
  const { notify } = useNotifications();

  const historyQ = trpc.knowledge.versionHistory.useQuery(
    { sourceRef },
    { enabled: !!sourceRef, retry: false },
  );

  const diffMut = trpc.knowledge.computeDiff.useMutation({
    onSuccess: (d) => setDiff(d),
    onError: (e) => notify({ title: 'Diff failed', description: e.message, severity: 'error', group: 'versioning' }),
  });

  const versions = historyQ.data?.versions ?? [];

  const handleSelectVersion = (v: DocumentVersion) => {
    setSelectedVersion(v);
    setDiff(null);

    // Auto-compute diff if there's a previous version
    const idx = versions.findIndex(ver => ver.id === v.id);
    if (idx < versions.length - 1) {
      const older = versions[idx + 1];
      // We'd need the actual content to diff — for now show metadata comparison
      // In production, fetch content from vector-store by document_id
      diffMut.mutate({
        oldText: `Version ${older.version} (${older.changeType})\nWords: ${older.fingerprint.wordCount}\nHash: ${older.fingerprint.sha256}\nDate: ${older.createdAt}`,
        newText: `Version ${v.version} (${v.changeType})\nWords: ${v.fingerprint.wordCount}\nHash: ${v.fingerprint.sha256}\nDate: ${v.createdAt}`,
      });
    }
  };

  return (
    <div className={cn('overflow-hidden', cardCls)}>
      <div className="border-b border-border/30 dark:border-border/30 px-5 py-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <History className="w-4 h-4 text-blue-500" /> Version History
        </h3>
        <span className="text-xs text-muted-foreground/60">
          {versions.length} version{versions.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="p-5">
        {historyQ.isLoading ? (
          <div className="flex items-center justify-center py-8 gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            <span className="text-xs text-muted-foreground/60">Loading history...</span>
          </div>
        ) : versions.length === 0 ? (
          <div className="text-center py-8 space-y-1">
            <GitCommitVertical className="w-6 h-6 text-muted-foreground/40 mx-auto" />
            <p className="text-xs text-muted-foreground/60">
              No version history for this document yet.
            </p>
            <p className="text-xs text-muted-foreground/60">
              Re-ingest the same source to track revisions.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Timeline */}
            <div>
              <p className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider mb-2">
                Timeline
              </p>
              <VersionTimeline
                versions={versions}
                selectedId={selectedVersion?.id}
                onSelect={handleSelectVersion}
              />
            </div>

            {/* Diff panel */}
            <div>
              <p className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider mb-2">
                Changes
              </p>
              {!selectedVersion ? (
                <div className="text-center py-8 text-xs text-muted-foreground/60">
                  Select a version to compare
                </div>
              ) : diffMut.isPending ? (
                <div className="flex items-center justify-center py-8 gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                  <span className="text-xs text-muted-foreground/60">Computing diff...</span>
                </div>
              ) : diff ? (
                <DiffViewer diff={diff} />
              ) : (
                <div className="text-center py-8 space-y-1">
                  <p className="text-xs text-muted-foreground/60">
                    v{selectedVersion.version} &mdash; {selectedVersion.changeType}
                  </p>
                  {selectedVersion.diffSummary && (
                    <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                      {selectedVersion.diffSummary}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
