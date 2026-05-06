/**
 * HKI Atelier — domain icon set.
 * Monoline 1.5px stroke at 24px viewport. Inherit `currentColor`.
 */
import * as React from "react";

type IconProps = React.SVGProps<SVGSVGElement> & { title?: string };

const baseProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const wrap =
  (path: React.ReactNode): React.FC<IconProps> =>
  ({ title, ...props }) => (
    <svg {...baseProps} {...props}>
      {title ? <title>{title}</title> : null}
      {path}
    </svg>
  );

export const KnowledgeIcon = wrap(
  <>
    <path d="M5 5v14a1 1 0 0 0 1 1h13" />
    <path d="M9 5v15" />
    <path d="M13 5h6v10h-6z" />
    <circle cx="16" cy="19.5" r="1.25" />
  </>,
);

export const AgentIcon = wrap(
  <>
    <ellipse cx="12" cy="12" rx="9" ry="4.5" />
    <ellipse cx="12" cy="12" rx="4.5" ry="9" />
    <circle cx="12" cy="12" r="1.5" />
  </>,
);

export const PipelineIcon = wrap(
  <>
    <circle cx="5" cy="12" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="19" cy="12" r="2" />
    <path d="M7 12h3M14 12h3" />
  </>,
);

export const GuardrailIcon = wrap(
  <>
    <path d="M12 3 4 6v6c0 4.5 3.5 8 8 9 4.5-1 8-4.5 8-9V6Z" />
    <path d="m9 12 2.2 2.2L15 10.5" />
  </>,
);

export const ConnectorIcon = wrap(
  <>
    <circle cx="6" cy="12" r="2.5" />
    <path d="M8.5 12h4l2 2h3" />
    <path d="M14.5 12 12.5 10" />
    <rect x="17" y="9" width="3" height="6" rx="1" />
  </>,
);

export const IngestIcon = wrap(
  <>
    <path d="M12 3v10" />
    <path d="m8 9 4 4 4-4" />
    <path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
  </>,
);

export const ValidateIcon = wrap(
  <>
    <path d="M7 4h7l5 5v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
    <path d="M14 4v5h5" />
    <path d="m9 14 2 2 4-4" />
  </>,
);

export const TaxonomyIcon = wrap(
  <>
    <circle cx="12" cy="4.5" r="1.5" />
    <circle cx="6" cy="13" r="1.5" />
    <circle cx="12" cy="13" r="1.5" />
    <circle cx="18" cy="13" r="1.5" />
    <circle cx="6" cy="20" r="1.5" />
    <circle cx="18" cy="20" r="1.5" />
    <path d="M12 6v5.5M6 14.5v4M18 14.5v4M7.5 12 11 5.5M16.5 12 13 5.5" />
  </>,
);

export const EvaluationIcon = wrap(
  <>
    <path d="M4 14a8 8 0 0 1 16 0" />
    <path d="m12 14 4-4" />
    <circle cx="12" cy="14" r="1" />
    <path d="M4 14h2M18 14h2" />
  </>,
);

export const GovernanceIcon = wrap(
  <>
    <path d="M4 9 12 4l8 5" />
    <path d="M5 9v9M19 9v9M9 11v6M15 11v6M3 20h18" />
  </>,
);

export const TraceIcon = wrap(
  <>
    <path d="M3 12h2l2-6 3 12 3-9 3 6 2-3h3" />
  </>,
);

export const EmbedIcon = wrap(
  <>
    <path d="M3 8h18M3 12h12M3 16h18" />
    <circle cx="20" cy="12" r="1.5" />
  </>,
);

export const HKI_ICON_REGISTRY = {
  knowledge: KnowledgeIcon,
  agent: AgentIcon,
  pipeline: PipelineIcon,
  guardrail: GuardrailIcon,
  connector: ConnectorIcon,
  ingest: IngestIcon,
  validate: ValidateIcon,
  taxonomy: TaxonomyIcon,
  evaluation: EvaluationIcon,
  governance: GovernanceIcon,
  trace: TraceIcon,
  embed: EmbedIcon,
} as const;

export type HkiIconName = keyof typeof HKI_ICON_REGISTRY;
