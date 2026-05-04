/**
 * Atomic Design System
 * Hierarchical component organization following Brad Frost's methodology
 */

import { colors, typography, spacing, effects, animation, composite } from "./tokens";

// ═══════════════════════════════════════════════════════════════════════════════
// ATOMS - Basic building blocks
// ═══════════════════════════════════════════════════════════════════════════════

export const atoms = {
  // Text atoms
  text: {
    heading1: {
      fontSize: typography.fontSize["5xl"],
      fontWeight: typography.fontWeight.bold,
      lineHeight: typography.lineHeight.tight,
      letterSpacing: typography.letterSpacing.tight,
      color: colors.semantic.text.primary,
    },
    heading2: {
      fontSize: typography.fontSize["4xl"],
      fontWeight: typography.fontWeight.semibold,
      lineHeight: typography.lineHeight.tight,
      letterSpacing: typography.letterSpacing.tight,
      color: colors.semantic.text.primary,
    },
    heading3: {
      fontSize: typography.fontSize["3xl"],
      fontWeight: typography.fontWeight.semibold,
      lineHeight: typography.lineHeight.snug,
      color: colors.semantic.text.primary,
    },
    heading4: {
      fontSize: typography.fontSize["2xl"],
      fontWeight: typography.fontWeight.medium,
      lineHeight: typography.lineHeight.snug,
      color: colors.semantic.text.primary,
    },
    body: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.normal,
      lineHeight: typography.lineHeight.normal,
      color: colors.semantic.text.secondary,
    },
    caption: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.normal,
      lineHeight: typography.lineHeight.normal,
      color: colors.semantic.text.muted,
    },
    label: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium,
      lineHeight: typography.lineHeight.tight,
      color: colors.semantic.text.primary,
    },
  },

  // Button atoms
  button: {
    base: {
      padding: `${spacing[2]} ${spacing[4]}`,
      borderRadius: effects.borderRadius.lg,
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium,
      transition: animation.transition.all,
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing[2],
    },
    sizes: {
      sm: {
        padding: `${spacing[1.5]} ${spacing[3]}`,
        fontSize: typography.fontSize.xs,
      },
      md: {
        padding: `${spacing[2]} ${spacing[4]}`,
        fontSize: typography.fontSize.sm,
      },
      lg: {
        padding: `${spacing[3]} ${spacing[6]}`,
        fontSize: typography.fontSize.base,
      },
      xl: {
        padding: `${spacing[4]} ${spacing[8]}`,
        fontSize: typography.fontSize.lg,
      },
    },
    variants: {
      primary: {
        background: colors.semantic.interactive.primary.default,
        color: colors.primitive.white,
        border: "none",
        "&:hover": {
          background: colors.semantic.interactive.primary.hover,
        },
        "&:active": {
          background: colors.semantic.interactive.primary.active,
        },
      },
      secondary: {
        background: "transparent",
        color: colors.semantic.interactive.primary.default,
        border: `1px solid ${colors.semantic.border.primary}`,
        "&:hover": {
          background: colors.semantic.background.secondary,
        },
      },
      ghost: {
        background: "transparent",
        color: colors.semantic.text.primary,
        border: "none",
        "&:hover": {
          background: colors.semantic.background.tertiary,
        },
      },
    },
  },

  // Input atoms
  input: {
    base: {
      padding: `${spacing[2]} ${spacing[3]}`,
      borderRadius: effects.borderRadius.md,
      fontSize: typography.fontSize.base,
      lineHeight: typography.lineHeight.normal,
      border: `1px solid ${colors.semantic.border.primary}`,
      background: colors.semantic.background.primary,
      color: colors.semantic.text.primary,
      transition: animation.transition.all,
      "&:focus": {
        outline: "none",
        borderColor: colors.semantic.border.focus,
        boxShadow: composite.focusRing.light,
      },
    },
  },

  // Icon atoms
  icon: {
    sizes: {
      xs: { width: "12px", height: "12px" },
      sm: { width: "16px", height: "16px" },
      md: { width: "20px", height: "20px" },
      lg: { width: "24px", height: "24px" },
      xl: { width: "32px", height: "32px" },
    },
  },

  // Badge atoms
  badge: {
    base: {
      padding: `${spacing[0.5]} ${spacing[2]}`,
      borderRadius: effects.borderRadius.full,
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.medium,
      display: "inline-flex",
      alignItems: "center",
      gap: spacing[1],
    },
    variants: {
      default: {
        background: colors.semantic.background.tertiary,
        color: colors.semantic.text.secondary,
      },
      success: {
        background: colors.primitive.green[100],
        color: colors.primitive.green[800],
      },
      warning: {
        background: colors.primitive.yellow[100],
        color: colors.primitive.yellow[800],
      },
      error: {
        background: colors.primitive.red[100],
        color: colors.primitive.red[800],
      },
      info: {
        background: colors.primitive.blue[100],
        color: colors.primitive.blue[800],
      },
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// MOLECULES - Combinations of atoms
// ═══════════════════════════════════════════════════════════════════════════════

export const molecules = {
  // Form field molecule (label + input + error)
  formField: {
    container: {
      display: "flex",
      flexDirection: "column",
      gap: spacing[1.5],
    },
    label: atoms.text.label,
    input: atoms.input.base,
    error: {
      ...atoms.text.caption,
      color: colors.semantic.interactive.danger.default,
    },
    hint: {
      ...atoms.text.caption,
      color: colors.semantic.text.muted,
    },
  },

  // Card molecule
  card: {
    base: {
      padding: spacing[6],
      borderRadius: effects.borderRadius.xl,
      background: colors.semantic.background.elevated,
      border: `1px solid ${colors.semantic.border.primary}`,
      boxShadow: effects.shadow.sm,
    },
    hover: {
      boxShadow: effects.shadow.md,
      transform: "translateY(-2px)",
      transition: animation.transition.all,
    },
    sections: {
      header: {
        marginBottom: spacing[4],
        paddingBottom: spacing[4],
        borderBottom: `1px solid ${colors.semantic.border.primary}`,
      },
      body: {
        // Content area
      },
      footer: {
        marginTop: spacing[4],
        paddingTop: spacing[4],
        borderTop: `1px solid ${colors.semantic.border.primary}`,
      },
    },
  },

  // Avatar molecule
  avatar: {
    container: {
      position: "relative",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      borderRadius: effects.borderRadius.full,
      background: colors.semantic.background.tertiary,
    },
    sizes: {
      sm: { width: "32px", height: "32px" },
      md: { width: "40px", height: "40px" },
      lg: { width: "48px", height: "48px" },
      xl: { width: "64px", height: "64px" },
    },
    image: {
      width: "100%",
      height: "100%",
      objectFit: "cover",
    },
    fallback: {
      ...atoms.text.label,
      textTransform: "uppercase",
    },
    status: {
      position: "absolute",
      bottom: 0,
      right: 0,
      width: "25%",
      height: "25%",
      borderRadius: effects.borderRadius.full,
      border: `2px solid ${colors.semantic.background.primary}`,
    },
  },

  // List item molecule
  listItem: {
    container: {
      display: "flex",
      alignItems: "center",
      gap: spacing[3],
      padding: spacing[3],
      borderRadius: effects.borderRadius.md,
      transition: animation.transition.all,
      cursor: "pointer",
      "&:hover": {
        background: colors.semantic.background.secondary,
      },
    },
    icon: atoms.icon.sizes.md,
    content: {
      flex: 1,
      minWidth: 0,
    },
    title: atoms.text.body,
    subtitle: atoms.text.caption,
    action: {
      marginLeft: "auto",
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// ORGANISMS - Complex UI components
// ═══════════════════════════════════════════════════════════════════════════════

export const organisms = {
  // Navigation organism
  navigation: {
    container: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: `${spacing[4]} ${spacing[6]}`,
      background: colors.semantic.background.elevated,
      borderBottom: `1px solid ${colors.semantic.border.primary}`,
    },
    brand: {
      display: "flex",
      alignItems: "center",
      gap: spacing[3],
      ...atoms.text.heading4,
    },
    menu: {
      display: "flex",
      gap: spacing[1],
      listStyle: "none",
    },
    menuItem: {
      ...atoms.button.base,
      ...atoms.button.variants.ghost,
    },
    actions: {
      display: "flex",
      gap: spacing[2],
    },
  },

  // Modal organism
  modal: {
    overlay: {
      position: "fixed",
      inset: 0,
      background: colors.semantic.background.overlay,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 40,
    },
    container: {
      ...molecules.card.base,
      maxWidth: "512px",
      width: "90%",
      maxHeight: "90vh",
      overflow: "auto",
    },
    header: {
      ...molecules.card.sections.header,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    },
    title: atoms.text.heading3,
    body: {
      padding: `${spacing[4]} 0`,
    },
    footer: {
      ...molecules.card.sections.footer,
      display: "flex",
      justifyContent: "flex-end",
      gap: spacing[3],
    },
  },

  // Sidebar organism
  sidebar: {
    container: {
      width: "280px",
      height: "100vh",
      background: colors.semantic.background.elevated,
      borderRight: `1px solid ${colors.semantic.border.primary}`,
      display: "flex",
      flexDirection: "column",
    },
    header: {
      padding: spacing[4],
      borderBottom: `1px solid ${colors.semantic.border.primary}`,
    },
    nav: {
      flex: 1,
      padding: spacing[2],
      overflowY: "auto",
    },
    footer: {
      padding: spacing[4],
      borderTop: `1px solid ${colors.semantic.border.primary}`,
    },
  },

  // Data table organism
  dataTable: {
    container: {
      width: "100%",
      borderRadius: effects.borderRadius.lg,
      overflow: "hidden",
      border: `1px solid ${colors.semantic.border.primary}`,
    },
    header: {
      background: colors.semantic.background.secondary,
      borderBottom: `1px solid ${colors.semantic.border.primary}`,
    },
    headerCell: {
      padding: `${spacing[3]} ${spacing[4]}`,
      ...atoms.text.label,
      textAlign: "left",
    },
    body: {
      background: colors.semantic.background.primary,
    },
    row: {
      borderBottom: `1px solid ${colors.semantic.border.primary}`,
      "&:hover": {
        background: colors.semantic.background.secondary,
      },
    },
    cell: {
      padding: `${spacing[3]} ${spacing[4]}`,
      ...atoms.text.body,
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATES - Page-level layouts
// ═══════════════════════════════════════════════════════════════════════════════

export const templates = {
  // Dashboard template
  dashboard: {
    container: {
      display: "grid",
      gridTemplateColumns: "280px 1fr",
      gridTemplateRows: "64px 1fr",
      height: "100vh",
    },
    header: {
      gridColumn: "1 / -1",
      ...organisms.navigation.container,
    },
    sidebar: {
      gridRow: "2",
      ...organisms.sidebar.container,
    },
    main: {
      gridRow: "2",
      padding: spacing[6],
      overflowY: "auto",
      background: colors.semantic.background.primary,
    },
  },

  // Landing page template
  landing: {
    container: {
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
    },
    header: organisms.navigation.container,
    hero: {
      padding: `${spacing[20]} ${spacing[6]}`,
      textAlign: "center",
      background: composite.gradient.mesh,
    },
    sections: {
      padding: `${spacing[16]} ${spacing[6]}`,
    },
    footer: {
      marginTop: "auto",
      padding: `${spacing[8]} ${spacing[6]}`,
      background: colors.semantic.background.secondary,
      borderTop: `1px solid ${colors.semantic.border.primary}`,
    },
  },

  // Form page template
  form: {
    container: {
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: spacing[6],
      background: colors.semantic.background.secondary,
    },
    card: {
      ...molecules.card.base,
      width: "100%",
      maxWidth: "448px",
    },
    header: {
      textAlign: "center",
      marginBottom: spacing[8],
    },
    fields: {
      display: "flex",
      flexDirection: "column",
      gap: spacing[4],
    },
    actions: {
      marginTop: spacing[6],
      display: "flex",
      flexDirection: "column",
      gap: spacing[3],
    },
  },
};

// Export atomic design system
export default {
  atoms,
  molecules,
  organisms,
  templates,
};
