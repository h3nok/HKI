/** 
 * ═══════════════════════════════════════════════════════════════════════════
 * COSTCO INNOVATIONS DESIGN SYSTEM — TAILWIND CONFIGURATION
 * Signature Platform — Enterprise Security & Intelligence
 * 
 * This configuration extends Tailwind CSS with the HKI Innovations
 * design tokens for consistent styling across all applications.
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * @type {import('tailwindcss').Config} 
 */
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      /* ═══════════════════════════════════════════════════════════════════
         COLOR SYSTEM
         Brand colors with full spectrum for both light and dark modes
         ═══════════════════════════════════════════════════════════════════ */
      colors: {
        // ─────────────────────────────────────────────────────────────────
        // COSTCO BLUE — Trust, Authority, Intelligence
        // Primary brand color (HSL: 229° 64% 47%)
        // ─────────────────────────────────────────────────────────────────
        'hki-blue': {
          25:  '#f5f7fd',
          50:  '#ebeffe',
          100: '#d4dbfc',
          200: '#a9b7f9',
          300: '#7e93f6',
          400: '#536ef3',
          500: '#0066B2', // Core brand blue
          600: '#2339a8',
          700: '#1b2d8e',
          800: '#142174',
          900: '#0d165a',
          950: '#080e3d',
          DEFAULT: '#0066B2',
        },

        // ─────────────────────────────────────────────────────────────────
        // COSTCO RED — Energy, Urgency, Critical Actions  
        // Secondary brand color (HSL: 0° 73% 51%)
        // ─────────────────────────────────────────────────────────────────
        'hki-red': {
          25:  '#fff7f7',
          50:  '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#E31837', // Core brand red
          600: '#b91c1c',
          700: '#991b1b',
          800: '#7f1d1d',
          900: '#631414',
          950: '#450a0a',
          DEFAULT: '#E31837',
        },

        // ─────────────────────────────────────────────────────────────────
        // NEUTRAL SCALE
        // Cool-tinted grays for professional enterprise interfaces
        // ─────────────────────────────────────────────────────────────────
        neutral: {
          0:   '#ffffff',
          25:  '#fcfcfc',
          50:  '#fafafa',
          75:  '#f7f7f8',
          100: '#f4f4f5',
          150: '#ececed',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          850: '#1f1f23',
          900: '#18181b',
          925: '#121215',
          950: '#09090b',
        },

        // ─────────────────────────────────────────────────────────────────
        // SEMANTIC STATUS COLORS
        // For system states, feedback, and data communication
        // ─────────────────────────────────────────────────────────────────
        success: {
          25:  '#f0fdf4',
          50:  '#dcfce7',
          100: '#bbf7d0',
          200: '#86efac',
          300: '#4ade80',
          400: '#22c55e',
          500: '#16a34a',
          600: '#15803d',
          700: '#166534',
          800: '#14532d',
          900: '#052e16',
          DEFAULT: '#16a34a',
        },
        warning: {
          25:  '#fffbeb',
          50:  '#fef3c7',
          100: '#fde68a',
          200: '#fcd34d',
          300: '#fbbf24',
          400: '#f59e0b',
          500: '#d97706',
          600: '#b45309',
          700: '#92400e',
          800: '#78350f',
          900: '#451a03',
          DEFAULT: '#d97706',
        },
        info: {
          25:  '#f0f9ff',
          50:  '#e0f2fe',
          100: '#bae6fd',
          200: '#7dd3fc',
          300: '#38bdf8',
          400: '#0ea5e9',
          500: '#0284c7',
          600: '#0369a1',
          700: '#075985',
          800: '#0c4a6e',
          900: '#082f49',
          DEFAULT: '#0284c7',
        },

        // ─────────────────────────────────────────────────────────────────
        // DATA VISUALIZATION PALETTE
        // For charts, graphs, and multi-series data
        // ─────────────────────────────────────────────────────────────────
        chart: {
          blue:    '#0066B2',
          red:     '#E31837',
          emerald: '#10b981',
          amber:   '#f59e0b',
          violet:  '#8b5cf6',
          cyan:    '#06b6d4',
          rose:    '#f43f5e',
          indigo:  '#6366f1',
          orange:  '#f97316',
          teal:    '#14b8a6',
        },

        // ─────────────────────────────────────────────────────────────────
        // LEGACY ALIASES (backward compatibility)
        // ─────────────────────────────────────────────────────────────────
        'duo-blue': {
          50:  '#ebeffe',
          100: '#d4dbfc',
          200: '#a9b7f9',
          300: '#7e93f6',
          400: '#536ef3',
          500: '#0066B2',
          600: '#2339a8',
          700: '#1b2d8e',
          800: '#142174',
          900: '#0d165a',
        },
        'duo-red': {
          50:  '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#E31837',
          600: '#b91c1c',
          700: '#991b1b',
          800: '#7f1d1d',
          900: '#631414',
        },
      },

      /* ═══════════════════════════════════════════════════════════════════
         TYPOGRAPHY
         Professional font stack with modular scale
         ═══════════════════════════════════════════════════════════════════ */
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Fira Code', 'Consolas', 'monospace'],
        display: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },

      fontSize: {
        'xs':   ['0.75rem', { lineHeight: '1rem' }],      // 12px
        'sm':   ['0.875rem', { lineHeight: '1.25rem' }],  // 14px
        'base': ['1rem', { lineHeight: '1.5rem' }],       // 16px
        'md':   ['1.125rem', { lineHeight: '1.75rem' }],  // 18px
        'lg':   ['1.25rem', { lineHeight: '1.75rem' }],   // 20px
        'xl':   ['1.5rem', { lineHeight: '2rem' }],       // 24px
        '2xl':  ['1.875rem', { lineHeight: '2.25rem' }],  // 30px
        '3xl':  ['2.25rem', { lineHeight: '2.5rem' }],    // 36px
        '4xl':  ['3rem', { lineHeight: '1.1' }],          // 48px
        '5xl':  ['3.75rem', { lineHeight: '1.1' }],       // 60px
        '6xl':  ['4.5rem', { lineHeight: '1.05' }],       // 72px
      },

      /* ═══════════════════════════════════════════════════════════════════
         SPACING SYSTEM
         4px base unit for consistent rhythm
         ═══════════════════════════════════════════════════════════════════ */
      spacing: {
        '0.5': '0.125rem',  // 2px
        '1':   '0.25rem',   // 4px
        '1.5': '0.375rem',  // 6px
        '2':   '0.5rem',    // 8px
        '2.5': '0.625rem',  // 10px
        '3':   '0.75rem',   // 12px
        '3.5': '0.875rem',  // 14px
        '4':   '1rem',      // 16px
        '5':   '1.25rem',   // 20px
        '6':   '1.5rem',    // 24px
        '7':   '1.75rem',   // 28px
        '8':   '2rem',      // 32px
        '9':   '2.25rem',   // 36px
        '10':  '2.5rem',    // 40px
        '11':  '2.75rem',   // 44px
        '12':  '3rem',      // 48px
        '14':  '3.5rem',    // 56px
        '16':  '4rem',      // 64px
        '20':  '5rem',      // 80px
        '24':  '6rem',      // 96px
        '28':  '7rem',      // 112px
        '32':  '8rem',      // 128px
        '36':  '9rem',      // 144px
        '40':  '10rem',     // 160px
        '44':  '11rem',     // 176px
        '48':  '12rem',     // 192px
        '52':  '13rem',     // 208px
        '56':  '14rem',     // 224px
        '60':  '15rem',     // 240px
        '64':  '16rem',     // 256px
        '72':  '18rem',     // 288px
        '80':  '20rem',     // 320px
        '96':  '24rem',     // 384px
      },

      /* ═══════════════════════════════════════════════════════════════════
         BORDER RADIUS
         Consistent rounding scale
         ═══════════════════════════════════════════════════════════════════ */
      borderRadius: {
        'none': '0',
        'xs':   '0.125rem',  // 2px
        'sm':   '0.25rem',   // 4px
        'md':   '0.375rem',  // 6px
        'DEFAULT': '0.5rem', // 8px
        'lg':   '0.5rem',    // 8px
        'xl':   '0.75rem',   // 12px
        '2xl':  '1rem',      // 16px
        '3xl':  '1.5rem',    // 24px
        'full': '9999px',
      },

      /* ═══════════════════════════════════════════════════════════════════
         SHADOWS & ELEVATION
         Multi-layer shadow system with brand glows
         ═══════════════════════════════════════════════════════════════════ */
      boxShadow: {
        // Standard elevation scale
        'none': 'none',
        'xs':   '0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 3px 0 rgba(0, 0, 0, 0.06)',
        'sm':   '0 2px 4px -1px rgba(0, 0, 0, 0.04), 0 4px 6px -1px rgba(0, 0, 0, 0.08)',
        'md':   '0 4px 6px -2px rgba(0, 0, 0, 0.03), 0 10px 15px -3px rgba(0, 0, 0, 0.08)',
        'lg':   '0 10px 10px -5px rgba(0, 0, 0, 0.02), 0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        'xl':   '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        '2xl':  '0 35px 60px -15px rgba(0, 0, 0, 0.3)',
        'inner': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',

        // Brand glow effects — Blue
        'glow-blue-sm': '0 0 0 1px rgba(43, 69, 194, 0.08), 0 2px 8px -2px rgba(43, 69, 194, 0.12), 0 4px 12px -4px rgba(43, 69, 194, 0.08)',
        'glow-blue-md': '0 0 0 1px rgba(43, 69, 194, 0.12), 0 4px 16px -4px rgba(43, 69, 194, 0.18), 0 8px 24px -8px rgba(43, 69, 194, 0.12)',
        'glow-blue-lg': '0 0 0 1px rgba(43, 69, 194, 0.16), 0 8px 32px -8px rgba(43, 69, 194, 0.24), 0 16px 48px -16px rgba(43, 69, 194, 0.16)',
        
        // Brand glow effects — Red
        'glow-red-sm': '0 0 0 1px rgba(220, 38, 38, 0.08), 0 2px 8px -2px rgba(220, 38, 38, 0.12), 0 4px 12px -4px rgba(220, 38, 38, 0.08)',
        'glow-red-md': '0 0 0 1px rgba(220, 38, 38, 0.12), 0 4px 16px -4px rgba(220, 38, 38, 0.18), 0 8px 24px -8px rgba(220, 38, 38, 0.12)',
        'glow-red-lg': '0 0 0 1px rgba(220, 38, 38, 0.16), 0 8px 32px -8px rgba(220, 38, 38, 0.24), 0 16px 48px -16px rgba(220, 38, 38, 0.16)',

        // Focus rings
        'ring-blue': '0 0 0 3px rgba(43, 69, 194, 0.25)',
        'ring-red':  '0 0 0 3px rgba(220, 38, 38, 0.25)',
      },

      /* ═══════════════════════════════════════════════════════════════════
         BACKGROUND IMAGES & GRADIENTS
         Brand gradient utilities
         ═══════════════════════════════════════════════════════════════════ */
      backgroundImage: {
        // Brand gradients
        'gradient-brand':           'linear-gradient(135deg, #0066B2 0%, #E31837 100%)',
        'gradient-brand-reverse':   'linear-gradient(135deg, #E31837 0%, #0066B2 100%)',
        'gradient-brand-vertical':  'linear-gradient(180deg, #0066B2 0%, #E31837 100%)',
        'gradient-brand-horizontal': 'linear-gradient(90deg, #0066B2 0%, #E31837 100%)',
        'gradient-brand-subtle':    'linear-gradient(135deg, rgba(43, 69, 194, 0.06) 0%, rgba(220, 38, 38, 0.06) 100%)',
        'gradient-brand-light':     'linear-gradient(135deg, #ebeffe 0%, #fef2f2 100%)',
        
        // Monochromatic gradients
        'gradient-blue':       'linear-gradient(135deg, #536ef3 0%, #2339a8 100%)',
        'gradient-blue-light': 'linear-gradient(135deg, #ebeffe 0%, #d4dbfc 100%)',
        'gradient-red':        'linear-gradient(135deg, #f87171 0%, #b91c1c 100%)',
        'gradient-red-light':  'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',

        // Shimmer gradient for loading states
        'gradient-shimmer': 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
      },

      /* ═══════════════════════════════════════════════════════════════════
         ANIMATIONS
         Expressive, smooth motion design
         ═══════════════════════════════════════════════════════════════════ */
      animation: {
        'fade-in':     'fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'fade-out':    'fadeOut 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-up':    'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-down':  'slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-left':  'slideLeft 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-right': 'slideRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'scale-in':    'scaleIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'scale-out':   'scaleOut 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-glow':  'pulseGlow 2s ease-in-out infinite',
        'shimmer':     'shimmer 2s linear infinite',
        'spin-slow':   'spin 2s linear infinite',
        'bounce-subtle': 'bounceSubtle 1s ease-in-out infinite',
      },

      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%':   { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%':   { opacity: '0', transform: 'translateY(-16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideLeft: {
          '0%':   { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideRight: {
          '0%':   { opacity: '0', transform: 'translateX(-16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%':   { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        scaleOut: {
          '0%':   { opacity: '1', transform: 'scale(1)' },
          '100%': { opacity: '0', transform: 'scale(0.95)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 1px rgba(43, 69, 194, 0.08), 0 2px 8px -2px rgba(43, 69, 194, 0.12)' },
          '50%':      { boxShadow: '0 0 0 1px rgba(43, 69, 194, 0.12), 0 4px 16px -4px rgba(43, 69, 194, 0.2)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        bounceSubtle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-4px)' },
        },
      },

      /* ═══════════════════════════════════════════════════════════════════
         TRANSITIONS
         Duration and timing function presets
         ═══════════════════════════════════════════════════════════════════ */
      transitionDuration: {
        'instant':  '50ms',
        'faster':   '100ms',
        'fast':     '150ms',
        'normal':   '200ms',
        'moderate': '250ms',
        'slow':     '300ms',
        'slower':   '400ms',
        'slowest':  '500ms',
      },

      transitionTimingFunction: {
        'smooth':     'cubic-bezier(0.16, 1, 0.3, 1)',
        'spring':     'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'swift':      'cubic-bezier(0.4, 0, 0.2, 1)',
        'emphasized': 'cubic-bezier(0.2, 0, 0, 1)',
        'decelerate': 'cubic-bezier(0, 0, 0.2, 1)',
      },

      /* ═══════════════════════════════════════════════════════════════════
         Z-INDEX SCALE
         Predictable stacking order
         ═══════════════════════════════════════════════════════════════════ */
      zIndex: {
        'behind':   '-1',
        'base':     '0',
        'raised':   '1',
        'dropdown': '10',
        'sticky':   '20',
        'fixed':    '30',
        'overlay':  '40',
        'modal':    '50',
        'popover':  '60',
        'toast':    '70',
        'tooltip':  '80',
        'max':      '9999',
      },

      /* ═══════════════════════════════════════════════════════════════════
         MAX-WIDTH CONTAINER SCALE
         For content width constraints
         ═══════════════════════════════════════════════════════════════════ */
      maxWidth: {
        'xs':   '20rem',   // 320px
        'sm':   '24rem',   // 384px
        'md':   '28rem',   // 448px
        'lg':   '32rem',   // 512px
        'xl':   '36rem',   // 576px
        '2xl':  '42rem',   // 672px
        '3xl':  '48rem',   // 768px
        '4xl':  '56rem',   // 896px
        '5xl':  '64rem',   // 1024px
        '6xl':  '72rem',   // 1152px
        '7xl':  '80rem',   // 1280px
        'full': '100%',
        'prose': '65ch',
      },

      /* ═══════════════════════════════════════════════════════════════════
         ASPECT RATIOS
         Common aspect ratio utilities
         ═══════════════════════════════════════════════════════════════════ */
      aspectRatio: {
        'auto':   'auto',
        'square': '1 / 1',
        'video':  '16 / 9',
        'photo':  '4 / 3',
        'wide':   '21 / 9',
        'portrait': '3 / 4',
      },
    },
  },

  /* ═══════════════════════════════════════════════════════════════════════
     PLUGINS
     Additional Tailwind functionality
     ═══════════════════════════════════════════════════════════════════════ */
  plugins: [],
}
