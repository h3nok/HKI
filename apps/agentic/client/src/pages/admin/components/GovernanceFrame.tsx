import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@hki/ui";
import { a, type AdminTone } from "../theme";

type GovernanceMetric = {
  label: string;
  value: string;
  tone?: AdminTone;
};

type GovernanceFrameProps = {
  title: string;
  description: string;
  icon: LucideIcon;
  eyebrow?: string;
  action?: ReactNode;
  metrics?: GovernanceMetric[];
  children: ReactNode;
  className?: string;
};

export function GovernanceFrame({
  title,
  description,
  icon: Icon,
  eyebrow = "Enterprise Governance",
  action,
  metrics = [],
  children,
  className,
}: GovernanceFrameProps) {
  return (
    <section className={cn("admin-governance-frame", className)}>
      <header className="admin-governance-frame__masthead">
        <div className="admin-governance-frame__identity">
          <div className="admin-governance-frame__seal">
            <Icon className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <div className="admin-governance-frame__eyebrow">
              <span aria-hidden="true" />
              {eyebrow}
            </div>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
        </div>

        <div className="admin-governance-frame__dock">
          {action ? (
            <div className="admin-governance-frame__action">{action}</div>
          ) : null}

          {metrics.length > 0 ? (
            <div className="admin-governance-frame__metrics" role="list">
              {metrics.map(metric => (
                <div
                  key={`${metric.label}:${metric.value}`}
                  className={cn(
                    "admin-governance-frame__metric",
                    metric.tone && `is-${metric.tone}`
                  )}
                  role="listitem"
                >
                  <span className="admin-governance-frame__metric-value">
                    {metric.value}
                  </span>
                  <span className="admin-governance-frame__metric-label">
                    {metric.label}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </header>

      <div className="admin-governance-frame__body">{children}</div>
    </section>
  );
}

type GovernanceRegistryProps = {
  title: string;
  description: string;
  countLabel?: string;
  tools?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function GovernanceRegistry({
  title,
  description,
  countLabel,
  tools,
  children,
  className,
}: GovernanceRegistryProps) {
  return (
    <section className={cn("admin-governance-registry", className)}>
      <div className="admin-governance-registry__header">
        <div>
          <div className="admin-governance-registry__eyebrow">
            Control Registry
          </div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>

        <div className="admin-governance-registry__tools">
          {countLabel ? (
            <span className="admin-governance-registry__count">
              {countLabel}
            </span>
          ) : null}
          {tools}
        </div>
      </div>

      <div className="admin-governance-registry__body">{children}</div>
    </section>
  );
}

export function GovernanceNotice({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(a.inset, "admin-governance-notice", className)}>
      {children}
    </div>
  );
}
