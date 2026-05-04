/**
 * Layout System - Enterprise Design Foundation
 * Grid, spacing, containers, and responsive breakpoints
 */

// ═══════════════════════════════════════════════════════════════════════════════
// BREAKPOINTS - Mobile-first responsive design
// ═══════════════════════════════════════════════════════════════════════════════

export const breakpoints = {
  xs: 0,      // Mobile portrait
  sm: 640,    // Mobile landscape
  md: 768,    // Tablet portrait
  lg: 1024,   // Tablet landscape / Small desktop
  xl: 1280,   // Desktop
  '2xl': 1536 // Large desktop
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// GRID SYSTEM - 12-column with responsive gutters
// ═══════════════════════════════════════════════════════════════════════════════

export const grid = {
  columns: 12,
  gutters: {
    xs: 16,  // 1rem
    sm: 20,  // 1.25rem
    md: 24,  // 1.5rem
    lg: 32,  // 2rem
    xl: 40,  // 2.5rem
    '2xl': 48 // 3rem
  }
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// SPACING SCALE - 4px base unit system
// ═══════════════════════════════════════════════════════════════════════════════

export const spacing = {
  0: '0px',
  px: '1px',
  0.5: '2px',    // 0.125rem
  1: '4px',      // 0.25rem - base unit
  1.5: '6px',    // 0.375rem
  2: '8px',      // 0.5rem
  2.5: '10px',   // 0.625rem
  3: '12px',     // 0.75rem
  3.5: '14px',   // 0.875rem
  4: '16px',     // 1rem
  5: '20px',     // 1.25rem
  6: '24px',     // 1.5rem
  7: '28px',     // 1.75rem
  8: '32px',     // 2rem
  9: '36px',     // 2.25rem
  10: '40px',    // 2.5rem
  11: '44px',    // 2.75rem
  12: '48px',    // 3rem
  14: '56px',    // 3.5rem
  16: '64px',    // 4rem
  20: '80px',    // 5rem
  24: '96px',    // 6rem
  28: '112px',   // 7rem
  32: '128px',   // 8rem
  36: '144px',   // 9rem
  40: '160px',   // 10rem
  44: '176px',   // 11rem
  48: '192px',   // 12rem
  52: '208px',   // 13rem
  56: '224px',   // 14rem
  60: '240px',   // 15rem
  64: '256px',   // 16rem
  72: '288px',   // 18rem
  80: '320px',   // 20rem
  96: '384px',   // 24rem
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// CONTAINERS - Max-widths and padding for each breakpoint
// ═══════════════════════════════════════════════════════════════════════════════

export const containers = {
  xs: {
    maxWidth: '100%',
    padding: spacing[4],  // 16px
  },
  sm: {
    maxWidth: '640px',
    padding: spacing[5],  // 20px
  },
  md: {
    maxWidth: '768px',
    padding: spacing[6],  // 24px
  },
  lg: {
    maxWidth: '1024px',
    padding: spacing[8],  // 32px
  },
  xl: {
    maxWidth: '1280px',
    padding: spacing[10], // 40px
  },
  '2xl': {
    maxWidth: '1536px',
    padding: spacing[12], // 48px
  },
  // Special containers
  prose: {
    maxWidth: '65ch',     // Optimal reading width
    padding: spacing[6],
  },
  narrow: {
    maxWidth: '512px',    // Forms, modals
    padding: spacing[6],
  },
  wide: {
    maxWidth: '1920px',   // Full-width sections
    padding: spacing[12],
  }
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// Z-INDEX LAYERS - Stacking context hierarchy
// ═══════════════════════════════════════════════════════════════════════════════

export const zIndex = {
  base: 0,          // Base content
  behind: -1,       // Background elements
  dropdown: 10,     // Dropdown menus
  sticky: 20,       // Sticky headers/footers
  overlay: 30,      // Overlays, masks
  modal: 40,        // Modal dialogs
  popover: 50,      // Popovers, tooltips
  toast: 60,        // Toast notifications
  tooltip: 70,      // Tooltips (highest)
  max: 9999,        // Maximum (use sparingly)
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// VISUAL HIERARCHY - Element importance levels
// ═══════════════════════════════════════════════════════════════════════════════

export const hierarchy = {
  primary: {
    scale: 1.2,
    weight: 700,
    contrast: 'high',
    spacing: spacing[8],
  },
  secondary: {
    scale: 1.1,
    weight: 600,
    contrast: 'medium-high',
    spacing: spacing[6],
  },
  tertiary: {
    scale: 1,
    weight: 500,
    contrast: 'medium',
    spacing: spacing[4],
  },
  quaternary: {
    scale: 0.9,
    weight: 400,
    contrast: 'medium-low',
    spacing: spacing[3],
  },
  supporting: {
    scale: 0.85,
    weight: 400,
    contrast: 'low',
    spacing: spacing[2],
  }
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// WHITE SPACE RATIOS - Golden ratio and harmonious spacing
// ═══════════════════════════════════════════════════════════════════════════════

export const whiteSpace = {
  ratio: 1.618,     // Golden ratio
  tight: 0.5,       // Compact spacing
  normal: 1,        // Default spacing
  relaxed: 1.5,     // Comfortable spacing
  loose: 2,         // Generous spacing
  
  // Section spacing
  section: {
    xs: spacing[8],   // 32px
    sm: spacing[12],  // 48px
    md: spacing[16],  // 64px
    lg: spacing[24],  // 96px
    xl: spacing[32],  // 128px
  },
  
  // Component spacing
  component: {
    xs: spacing[2],   // 8px
    sm: spacing[3],   // 12px
    md: spacing[4],   // 16px
    lg: spacing[6],   // 24px
    xl: spacing[8],   // 32px
  }
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// GRID UTILITIES - Helper functions
// ═══════════════════════════════════════════════════════════════════════════════

export const gridUtils = {
  // Calculate column width
  getColumnWidth: (cols: number, containerWidth: number, gutter: number) => {
    const totalGutters = (grid.columns - 1) * gutter;
    const availableWidth = containerWidth - totalGutters;
    return (availableWidth / grid.columns) * cols;
  },
  
  // Get responsive value
  getResponsiveValue: <T>(values: Partial<Record<keyof typeof breakpoints, T>>, currentBreakpoint: keyof typeof breakpoints): T | undefined => {
    const breakpointOrder = Object.keys(breakpoints) as (keyof typeof breakpoints)[];
    const currentIndex = breakpointOrder.indexOf(currentBreakpoint);
    
    // Check from current breakpoint down to find a value
    for (let i = currentIndex; i >= 0; i--) {
      const bp = breakpointOrder[i];
      if (bp && values[bp] !== undefined) {
        return values[bp];
      }
    }
    
    return undefined;
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// LAYOUT PATTERNS - Common layout configurations
// ═══════════════════════════════════════════════════════════════════════════════

export const layoutPatterns = {
  // Sidebar + Main content
  withSidebar: {
    sidebar: { cols: 3, minWidth: '280px', maxWidth: '320px' },
    main: { cols: 9, minWidth: '0' }
  },
  
  // Two column
  twoColumn: {
    left: { cols: 6 },
    right: { cols: 6 }
  },
  
  // Three column
  threeColumn: {
    left: { cols: 4 },
    center: { cols: 4 },
    right: { cols: 4 }
  },
  
  // Holy grail (header, footer, sidebar, main, aside)
  holyGrail: {
    header: { cols: 12 },
    sidebar: { cols: 2 },
    main: { cols: 7 },
    aside: { cols: 3 },
    footer: { cols: 12 }
  },
  
  // Dashboard
  dashboard: {
    header: { cols: 12, height: '64px' },
    sidebar: { cols: 2, minWidth: '240px' },
    main: { cols: 10 },
    widgets: { cols: [4, 4, 4] } // Three equal widgets
  }
} as const;

export default {
  breakpoints,
  grid,
  spacing,
  containers,
  zIndex,
  hierarchy,
  whiteSpace,
  gridUtils,
  layoutPatterns
};
