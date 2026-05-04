import { Shield, ShieldAlert, BookOpen, Target, Crosshair, Zap, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@hki/ui';
import type { QualityReport } from '@shared/knowledge-types';

interface QualityReportCardProps {
  report: QualityReport;
}

function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color =
    score >= 80 ? 'text-primary' :
    score >= 60 ? 'text-amber-500' :
    'text-red-500';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" strokeWidth={3}
          className="stroke-border"
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" strokeWidth={3} strokeLinecap="round"
          className={cn('transition-all duration-700', color.replace('text-', 'stroke-'))}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
        />
      </svg>
      <span className={cn('absolute text-sm font-bold', color)}>
        {Math.round(score)}
      </span>
    </div>
  );
}

function DimensionBar({ label, score, maxScore = 25, icon: Icon, details }: {
  label: string;
  score: number;
  maxScore?: number;
  icon: typeof Shield;
  details: string;
}) {
  const pct = (score / maxScore) * 100;
  const color =
    pct >= 80 ? 'bg-primary' :
    pct >= 60 ? 'bg-amber-500' :
    'bg-red-500';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className="w-3 h-3 text-muted-foreground/60" />
          <span className="text-[11px] font-semibold text-foreground">{label}</span>
        </div>
        <span className="text-xs font-bold text-muted-foreground">
          {score}/{maxScore}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted dark:bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground/60">{details}</p>
    </div>
  );
}

export default function QualityReportCard({ report }: QualityReportCardProps) {
  return (
    <div className="space-y-4">
      {/* Header with overall score */}
      <div className="flex items-center gap-4">
        <ScoreRing score={report.overallScore} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">
            Quality Score
          </p>
          <p className="text-[11px] text-muted-foreground/60 mt-0.5">
            {report.overallScore >= 80 ? 'High quality — ready for review' :
             report.overallScore >= 60 ? 'Moderate quality — needs attention' :
             'Low quality — significant improvements needed'}
          </p>
          {report.autoApproveEligible && (
            <div className="flex items-center gap-1 mt-1 text-xs font-semibold text-primary dark:text-primary">
              <CheckCircle className="w-3 h-3" /> Eligible for auto-approval
            </div>
          )}
        </div>
      </div>

      {/* Dimension bars */}
      <div className="space-y-3">
        <DimensionBar
          label="Completeness"
          score={report.completeness.score}
          icon={BookOpen}
          details={report.completeness.details}
        />
        <DimensionBar
          label="Specificity"
          score={report.specificity.score}
          icon={Target}
          details={report.specificity.details}
        />
        <DimensionBar
          label="Accuracy Signals"
          score={report.accuracySignals.score}
          icon={Crosshair}
          details={report.accuracySignals.details}
        />
        <DimensionBar
          label="Actionability"
          score={report.actionability.score}
          icon={Zap}
          details={report.actionability.details}
        />
      </div>

      {/* Readability */}
      <div className="p-3 rounded-xl bg-muted/60 dark:bg-muted/60">
        <div className="flex items-center gap-1.5 mb-2">
          <BookOpen className="w-3 h-3 text-blue-500" />
          <span className="text-[11px] font-semibold text-foreground">Readability</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-lg font-bold text-foreground">
              {report.readability.fleschKincaidGrade}
            </p>
            <p className="text-xs text-muted-foreground/60 uppercase tracking-wider">Grade Level</p>
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">
              {report.readability.fleschReadingEase}
            </p>
            <p className="text-xs text-muted-foreground/60 uppercase tracking-wider">Reading Ease</p>
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">
              {report.readability.wordCount}
            </p>
            <p className="text-xs text-muted-foreground/60 uppercase tracking-wider">Words</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-1.5">
          {report.readability.gradeLabel}
        </p>
      </div>

      {/* PII Alert */}
      {report.piiScan.piiDetected ? (
        <div className="flex items-start gap-2 p-3 rounded-xl border border-red-500/20 bg-red-500/5">
          <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] font-semibold text-red-600 dark:text-red-400">
              PII Detected
            </p>
            <p className="text-xs text-red-500/80 mt-0.5">
              {report.piiScan.summary}
            </p>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {report.piiScan.categoriesFound.map((cat) => (
                <span key={cat} className="px-1.5 py-0.5 text-xs font-semibold rounded bg-red-500/10 text-red-500">
                  {cat}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 p-3 rounded-xl border border-primary/20 bg-primary/5">
          <Shield className="w-4 h-4 text-primary" />
          <p className="text-[11px] font-medium text-primary dark:text-primary">
            No PII detected
          </p>
        </div>
      )}
    </div>
  );
}
