import { Shield, Target, BookCheck, ListChecks } from 'lucide-react';
import { cn } from '@hki/ui';
import type { RAGEvalResult, RAGEvalDimension } from '@shared/knowledge-types';

interface RAGEvalCardProps {
  result: RAGEvalResult;
}

const DIMENSION_META: Record<string, { icon: typeof Shield; label: string; color: string }> = {
  faithfulness: { icon: Shield, label: 'Faithfulness', color: 'text-blue-500' },
  relevance: { icon: Target, label: 'Relevance', color: 'text-violet-500' },
  contextRecall: { icon: BookCheck, label: 'Context Recall', color: 'text-amber-500' },
  completeness: { icon: ListChecks, label: 'Completeness', color: 'text-primary' },
};

const GRADE_STYLES: Record<string, string> = {
  A: 'text-primary bg-primary/10 border-primary/30',
  B: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
  C: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
  D: 'text-orange-500 bg-orange-500/10 border-orange-500/30',
  F: 'text-red-500 bg-red-500/10 border-red-500/30',
};

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 h-1.5 rounded-full bg-muted dark:bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color.replace('text-', 'bg-'))}
          style={{ width: `${Math.round(score * 100)}%` }}
        />
      </div>
      <span className={cn('text-xs font-bold tabular-nums w-8 text-right', color)}>
        {(score * 100).toFixed(0)}%
      </span>
    </div>
  );
}

export default function RAGEvalCard({ result }: RAGEvalCardProps) {
  const dimensions: [string, RAGEvalDimension][] = [
    ['faithfulness', result.faithfulness],
    ['relevance', result.relevance],
    ['contextRecall', result.contextRecall],
    ['completeness', result.completeness],
  ];

  return (
    <div className="space-y-4">
      {/* Overall grade + score */}
      <div className="flex items-center gap-4">
        <div className={cn(
          'flex items-center justify-center w-14 h-14 rounded-2xl border-2 text-2xl font-black',
          GRADE_STYLES[result.grade] ?? GRADE_STYLES.F,
        )}>
          {result.grade}
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">
            Overall Score: {(result.overallScore * 100).toFixed(0)}%
          </p>
          <p className="text-xs text-muted-foreground/60">
            {result.grade === 'A' ? 'Excellent — production-ready answer' :
             result.grade === 'B' ? 'Good — minor improvements possible' :
             result.grade === 'C' ? 'Fair — some quality concerns' :
             result.grade === 'D' ? 'Poor — significant issues detected' :
             'Failing — answer needs rework'}
          </p>
        </div>
      </div>

      {/* Dimension scores */}
      <div className="space-y-2.5">
        {dimensions.map(([key, dim]) => {
          const meta = DIMENSION_META[key];
          if (!meta) return null;
          const Icon = meta.icon;
          return (
            <div key={key} className="space-y-1">
              <div className="flex items-center gap-2">
                <Icon className={cn('w-3.5 h-3.5', meta.color)} />
                <span className="text-[11px] font-semibold text-foreground">
                  {meta.label}
                </span>
                <ScoreBar score={dim.score} color={meta.color} />
              </div>
              {dim.rationale && (
                <p className="text-xs text-muted-foreground dark:text-muted-foreground pl-5.5 ml-px">
                  {dim.rationale}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
