/**
 * Design Tokens - Single source of truth for design decisions
 * Following W3C Design Tokens Community Group specification
 */

// ═══════════════════════════════════════════════════════════════════════════════
// COLOR TOKENS - WCAG AA/AAA Compliant
// ═══════════════════════════════════════════════════════════════════════════════

export const colors = {
  // Primitive colors (raw values)
  primitive: {
    // HKI Brand (standardized across all apps)
    hkiBlue: '#0066B2',
    hkiRed: '#E31837',
    
    // Neutrals
    white: '#FFFFFF',
    black: '#000000',
    
    // Gray scale (WCAG compliant)
    gray: {
      50: '#F9FAFB',
      100: '#F3F4F6',
      200: '#E5E7EB',
      300: '#D1D5DB',
      400: '#9CA3AF',
      500: '#6B7280',
      600: '#4B5563',
      700: '#374151',
      800: '#1F2937',
      900: '#111827',
      950: '#030712',
    },
    
    // Semantic colors
    blue: {
      50: '#EFF6FF',
      100: '#DBEAFE',
      200: '#BFDBFE',
      300: '#93C5FD',
      400: '#60A5FA',
      500: '#3B82F6',
      600: '#2563EB',
      700: '#1D4ED8',
      800: '#1E40AF',
      900: '#1E3A8A',
    },
    
    green: {
      50: '#F0FDF4',
      100: '#DCFCE7',
      200: '#BBF7D0',
      300: '#86EFAC',
      400: '#4ADE80',
      500: '#22C55E',
      600: '#16A34A',
      700: '#15803D',
      800: '#166534',
      900: '#14532D',
    },
    
    red: {
      50: '#FEF2F2',
      100: '#FEE2E2',
      200: '#FECACA',
      300: '#FCA5A5',
      400: '#F87171',
      500: '#EF4444',
      600: '#DC2626',
      700: '#B91C1C',
      800: '#991B1B',
      900: '#7F1D1D',
    },
    
    yellow: {
      50: '#FEFCE8',
      100: '#FEF9C3',
      200: '#FEF08A',
      300: '#FDE047',
      400: '#FACC15',
      500: '#EAB308',
      600: '#CA8A04',
      700: '#A16207',
      800: '#854D0E',
      900: '#713F12',
    },
  },
  
  // Semantic tokens (contextual use)
  semantic: {
    // Text colors with WCAG contrast ratios
    text: {
      primary: {
        light: '#111827',      // gray-900 - AAA on white
        dark: '#F9FAFB',       // gray-50 - AAA on gray-900
      },
      secondary: {
        light: '#4B5563',      // gray-600 - AA on white
        dark: '#D1D5DB',       // gray-300 - AA on gray-900
      },
      muted: {
        light: '#6B7280',      // gray-500 - AA Large on white
        dark: '#9CA3AF',       // gray-400 - AA on gray-900
      },
      disabled: {
        light: '#9CA3AF',      // gray-400
        dark: '#6B7280',       // gray-500
      },
      inverse: {
        light: '#FFFFFF',
        dark: '#111827',
      },
    },
    
    // Background colors
    background: {
      primary: {
        light: '#FFFFFF',
        dark: '#111827',       // gray-900
      },
      secondary: {
        light: '#F9FAFB',      // gray-50
        dark: '#1F2937',       // gray-800
      },
      tertiary: {
        light: '#F3F4F6',      // gray-100
        dark: '#374151',       // gray-700
      },
      elevated: {
        light: '#FFFFFF',
        dark: '#1F2937',       // gray-800
      },
      overlay: {
        light: 'rgba(0, 0, 0, 0.5)',
        dark: 'rgba(0, 0, 0, 0.7)',
      },
    },
    
    // Border colors
    border: {
      primary: {
        light: '#E5E7EB',      // gray-200
        dark: '#374151',       // gray-700
      },
      secondary: {
        light: '#D1D5DB',      // gray-300
        dark: '#4B5563',       // gray-600
      },
      focus: {
        light: '#3B82F6',      // blue-500
        dark: '#60A5FA',       // blue-400
      },
    },
    
    // Interactive states
    interactive: {
      primary: {
        default: '#0066B2',    // HKI Blue
        hover: '#00528E',
        active: '#003E6B',
        disabled: '#9CA3AF',
      },
      secondary: {
        default: '#E31837',    // HKI Red
        hover: '#B91C1C',
        active: '#991B1B',
        disabled: '#FCA5A5',
      },
      success: {
        default: '#22C55E',
        hover: '#16A34A',
        active: '#15803D',
      },
      warning: {
        default: '#EAB308',
        hover: '#CA8A04',
        active: '#A16207',
      },
      danger: {
        default: '#EF4444',
        hover: '#DC2626',
        active: '#B91C1C',
      },
    },
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// TYPOGRAPHY TOKENS
// ═══════════════════════════════════════════════════════════════════════════════

export const typography = {
  // Font families
  fontFamily: {
    sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
    mono: ['JetBrains Mono', 'SF Mono', 'Monaco', 'Consolas', 'monospace'],
    display: ['Inter', 'system-ui', 'sans-serif'],
  },
  
  // Font sizes (rem)
  fontSize: {
    xs: '0.75rem',      // 12px
    sm: '0.875rem',     // 14px
    base: '1rem',       // 16px
    lg: '1.125rem',     // 18px
    xl: '1.25rem',      // 20px
    '2xl': '1.5rem',    // 24px
    '3xl': '1.875rem',  // 30px
    '4xl': '2.25rem',   // 36px
    '5xl': '3rem',      // 48px
    '6xl': '3.75rem',   // 60px
    '7xl': '4.5rem',    // 72px
    '8xl': '6rem',      // 96px
    '9xl': '8rem',      // 128px
  },
  
  // Font weights
  fontWeight: {
    thin: 100,
    extralight: 200,
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
    black: 900,
  },
  
  // Line heights
  lineHeight: {
    none: 1,
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },
  
  // Letter spacing
  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// SPACING TOKENS (matches layout.ts spacing scale)
// ═══════════════════════════════════════════════════════════════════════════════

export const spacing = {
  0: '0px',
  px: '1px',
  0.5: '0.125rem',   // 2px
  1: '0.25rem',      // 4px - base unit
  1.5: '0.375rem',   // 6px
  2: '0.5rem',       // 8px
  2.5: '0.625rem',   // 10px
  3: '0.75rem',      // 12px
  3.5: '0.875rem',   // 14px
  4: '1rem',         // 16px
  5: '1.25rem',      // 20px
  6: '1.5rem',       // 24px
  7: '1.75rem',      // 28px
  8: '2rem',         // 32px
  9: '2.25rem',      // 36px
  10: '2.5rem',      // 40px
  12: '3rem',        // 48px
  14: '3.5rem',      // 56px
  16: '4rem',        // 64px
  20: '5rem',        // 80px
  24: '6rem',        // 96px
  28: '7rem',        // 112px
  32: '8rem',        // 128px
  40: '10rem',       // 160px
  48: '12rem',       // 192px
  56: '14rem',       // 224px
  64: '16rem',       // 256px
  72: '18rem',       // 288px
  80: '20rem',       // 320px
  96: '24rem',       // 384px
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// EFFECTS TOKENS
// ═══════════════════════════════════════════════════════════════════════════════

export const effects = {
  // Shadows
  shadow: {
    xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    sm: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.06)',
    base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.06)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
    none: '0 0 #0000',
  },
  
  // Border radius
  borderRadius: {
    none: '0px',
    sm: '0.125rem',    // 2px
    base: '0.25rem',   // 4px
    md: '0.375rem',    // 6px
    lg: '0.5rem',      // 8px
    xl: '0.75rem',     // 12px
    '2xl': '1rem',     // 16px
    '3xl': '1.5rem',   // 24px
    full: '9999px',
  },
  
  // Blur
  blur: {
    none: '0',
    sm: '4px',
    base: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    '2xl': '40px',
    '3xl': '64px',
  },
  
  // Opacity
  opacity: {
    0: '0',
    5: '0.05',
    10: '0.1',
    20: '0.2',
    25: '0.25',
    30: '0.3',
    40: '0.4',
    50: '0.5',
    60: '0.6',
    70: '0.7',
    75: '0.75',
    80: '0.8',
    90: '0.9',
    95: '0.95',
    100: '1',
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATION TOKENS
// ═══════════════════════════════════════════════════════════════════════════════

export const animation = {
  // Duration
  duration: {
    instant: '0ms',
    fast: '150ms',
    base: '200ms',
    moderate: '300ms',
    slow: '500ms',
    slower: '700ms',
    slowest: '1000ms',
  },
  
  // Easing
  easing: {
    linear: 'linear',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },
  
  // Transitions
  transition: {
    all: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
    colors: 'colors 200ms cubic-bezier(0.4, 0, 0.2, 1)',
    opacity: 'opacity 200ms cubic-bezier(0.4, 0, 0.2, 1)',
    shadow: 'box-shadow 200ms cubic-bezier(0.4, 0, 0.2, 1)',
    transform: 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSITE TOKENS - Combinations of primitives
// ═══════════════════════════════════════════════════════════════════════════════

export const composite = {
  // Focus ring
  focusRing: {
    light: `0 0 0 2px ${colors.semantic.border.focus.light}`,
    dark: `0 0 0 2px ${colors.semantic.border.focus.dark}`,
  },
  
  // Glass morphism
  glass: {
    light: {
      background: 'rgba(255, 255, 255, 0.7)',
      border: 'rgba(255, 255, 255, 0.2)',
      shadow: '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
    },
    dark: {
      background: 'rgba(17, 24, 39, 0.7)',
      border: 'rgba(255, 255, 255, 0.1)',
      shadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
    },
  },
  
  // Gradients
  gradient: {
    brand: 'linear-gradient(135deg, #0066B2 0%, #E31837 100%)',
    blue: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
    purple: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
    mesh: 'radial-gradient(at 40% 20%, #3B82F6 0px, transparent 50%), radial-gradient(at 80% 0%, #8B5CF6 0px, transparent 50%), radial-gradient(at 0% 50%, #60A5FA 0px, transparent 50%)',
  },
} as const;

// Export everything as default
export default {
  colors,
  typography,
  spacing,
  effects,
  animation,
  composite,
};
