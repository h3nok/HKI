/**
 * Atelier <SectionHeader /> — eyebrow + title + optional description + actions.
 * Single hairline rule below. Drop-in replacement for ad-hoc section heads.
 */
import * as React from "react";

import { ui } from "../theme/utilities";
import { cn } from "../utils";

export interface SectionHeaderProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "title"
> {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}

export const SectionHeader = React.forwardRef<
  HTMLDivElement,
  SectionHeaderProps
>(({ eyebrow, title, description, actions, className, ...rest }, ref) => (
  <div ref={ref} className={cn(ui.sectionHeader, className)} {...rest}>
    <div className={ui.sectionHeaderTitleStack}>
      {eyebrow ? <span className={ui.eyebrow}>{eyebrow}</span> : null}
      <h2 className={ui.heading}>{title}</h2>
      {description ? <p className={ui.bodySm}>{description}</p> : null}
    </div>
    {actions ? <div className={ui.sectionHeaderActions}>{actions}</div> : null}
  </div>
));
SectionHeader.displayName = "SectionHeader";
