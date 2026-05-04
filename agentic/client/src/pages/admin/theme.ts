export const a = {
  canvas: "admin-control-plane-canvas",
  card: "admin-surface-card",
  inset: "admin-surface-inset",
  hero: "admin-surface-hero",
  panelPrimary: "admin-panel-primary",
  dataPanel: "admin-data-panel",
  tabList: "admin-tab-list",
  tabTrigger: "admin-tab-trigger",
  cardHeader: "admin-card-header",
  previewRow: "admin-preview-row",
  field: "admin-field",
  toolbarButton: "admin-toolbar-button",
  toolbarIconButton: "admin-toolbar-button admin-toolbar-button--icon",
  breadcrumbBar: "admin-breadcrumb-bar",
  sectionEyebrow: "admin-section-eyebrow",
  sectionLabel: "admin-sidebar-section-label",
  metricCard: "admin-metric-card",
  metricIcon: "admin-metric-icon",
  metricLabel: "admin-metric-label",
  metricValue: "admin-metric-value",
  pillPrimary: "admin-pill-primary",
  pillPositive: "admin-pill-positive",
  pillWarning: "admin-pill-warning",
  pillCritical: "admin-pill-critical",
  pillNeutral: "admin-pill-neutral",
  iconPrimary: "admin-icon-primary",
  iconPositive: "admin-icon-positive",
  iconWarning: "admin-icon-warning",
  iconCritical: "admin-icon-critical",
  iconNeutral: "admin-icon-neutral",
  subtleText: "text-muted-foreground/72",
  microText: "text-muted-foreground/65",
  microTextStrong: "text-muted-foreground/80",
} as const;

export type AdminTone =
  | "primary"
  | "positive"
  | "warning"
  | "critical"
  | "neutral";
