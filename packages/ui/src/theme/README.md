# Signature Design System

Enterprise-grade, type-safe design token system for the Signature platform.

**Source of Truth**: `packages/ui/tokens/index.css`

## Quick Start

```tsx
import { 
  // Colors
  colors, surfaces, text, borders, accent,
  // Elevation
  shadows, glows, focusRings,
  // Layout
  spacing, radius, typography, layout,
  // Animation
  animation, duration, easing,
  // Utilities
  ui, cn, getStatusColors, gradients
} from '@signature/ui';
```

## Core Exports

### Color System

```tsx
import { colors, surfaces, text, borders } from '@signature/ui';

// Brand colors
colors.brand.blue[500]  // #2b45c2 - Core brand Iris
colors.brand.red[500]   // #dc2626 - Core brand red

// Warm neutrals (No-Washout palette)
colors.neutral[50]      // App background
colors.neutral[0]       // Cards/panels

// Semantic status colors
colors.status.success[500]
colors.status.warning[500]
colors.status.error[500]
colors.status.info[500]

// Pre-mapped semantic tokens
surfaces.background     // App background
surfaces.base          // Cards
text.primary           // Body text
borders.default        // Standard borders
```

### Spacing & Sizing

```tsx
import { spacing, radius, shadows, componentSize } from '@signature/ui';

spacing[4]             // 1rem (16px)
radius.xl              // 0.75rem (12px)
shadows.md             // Medium shadow
componentSize.button.md // Button height
```

### Typography

```tsx
import { typography } from '@signature/ui';

typography.fontFamily.sans
typography.fontSize.lg
typography.fontWeight.semibold
```

### Animation

```tsx
import { animation, duration, easing } from '@signature/ui';

// Framer Motion variants
<motion.div variants={animation.fadeInUp} initial="hidden" animate="visible">

// Staggered children
<motion.div variants={animation.staggerContainer(0.1)}>
  <motion.div variants={animation.staggerItem}>Item 1</motion.div>
  <motion.div variants={animation.staggerItem}>Item 2</motion.div>
</motion.div>

// Timing values
duration.fast           // 150ms
easing.smooth           // Smooth deceleration curve
```

### Utility Classes (`ui`)

Pre-composed Tailwind class strings:

```tsx
import { ui, cn } from '@signature/ui';

// Cards
<div className={ui.card}>Basic card</div>
<div className={ui.cardGlass}>Glassmorphic card</div>
<div className={ui.cardInteractive}>Clickable card</div>

// Typography
<h1 className={ui.h1}>Page Title</h1>
<p className={ui.textBody}>Body text</p>
<span className={ui.textMuted}>Secondary text</span>

// Buttons
<button className={ui.btnPrimary}>Primary</button>
<button className={ui.btnSecondary}>Secondary</button>
<button className={ui.btnGhost}>Ghost</button>

// Badges
<span className={cn(ui.badge, ui.badgeSuccess)}>Active</span>
<span className={cn(ui.badge, ui.badgeWarning)}>Pending</span>

// Inputs
<input className={ui.input} />

// Layout
<div className={ui.container}>Centered content</div>
<div className={ui.stackMd}>Vertical stack with gap</div>
<div className={ui.rowMd}>Horizontal row with gap</div>

// Accessibility
<button className={cn(ui.btnPrimary, ui.focusRing)}>
  Accessible button
</button>
```

### Class Composition (`cn`)

Merge classes with conflict resolution:

```tsx
import { cn } from '@signature/ui';

// Conditional classes
<div className={cn(
  ui.card,
  isActive && 'ring-2 ring-blue-500',
  className
)}>

// Override defaults
<div className={cn(ui.card, 'rounded-none')}>
```

### Gradients

```tsx
import { gradients } from '@signature/ui';

// CSS gradient strings
style={{ background: gradients.brand }}
style={{ background: gradients.blue }}
style={{ background: gradients.brandSubtle }}
```

### Utility Functions

```tsx
import { getStatusColors, transition, gradientText } from '@signature/ui';

// Status-specific colors
const { bg, text, border, icon } = getStatusColors('success');

// CSS transition string
style={{ transition: transition(['opacity', 'transform'], 'fast', 'smooth') }}

// Gradient text helper
<span className={gradientText('from-blue-500 to-red-500')}>
  Gradient Text
</span>
```

## TypeScript Types

```tsx
import type { 
  StatusType,
  ColorStep,
  SpacingKey,
  RadiusKey,
  DurationKey,
  EasingKey 
} from '@signature/ui';

function Badge({ status }: { status: StatusType }) {
  const colors = getStatusColors(status);
  // ...
}
```

## File Structure

```
packages/ui/src/theme/
├── design-system.ts   # Core token definitions + types
├── utilities.ts       # Tailwind utility classes (ui, cn)
├── tokens.ts          # Exports + Ant Design theme + legacy compat
└── README.md          # This file
```

## Migration from Legacy

```tsx
// Old (still works)
import { tokens, cx } from '@signature/ui';
tokens.colors.brand.blue[500]
cx.card

// New (recommended)
import { colors, ui } from '@signature/ui';
colors.brand.blue[500]
ui.cardGlass
```
