# @hki/ui

Shared design system package for the HKI AI Platform monorepo. Includes React components, CSS tokens, and Tailwind configuration.

## Contents

- **src/components/** - React UI components (Button, Card, Input, etc.)
- **tokens/index.css** - CSS custom properties for colors, spacing, typography
- **styles/globals.css** - Utility classes and animations
- **tailwind.config.js** - Shared Tailwind configuration

## Usage

### Import Components

```tsx
import { Button, Card, CardHeader, CardTitle, CardContent, Input, Label, Badge, Skeleton, Separator } from '@hki/ui';

function MyComponent() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Example</CardTitle>
      </CardHeader>
      <CardContent>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" placeholder="Enter email" />
        <Button>Submit</Button>
      </CardContent>
    </Card>
  );
}
```

### Button Variants

```tsx
<Button variant="default">Default</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="destructive">Destructive</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
<Button size="icon"><Icon /></Button>
```

### Badge Variants

```tsx
<Badge variant="default">Default</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="destructive">Error</Badge>
<Badge variant="outline">Outline</Badge>
<Badge variant="success">Success</Badge>
<Badge variant="warning">Warning</Badge>
```

### Import CSS tokens in your app

```css
/* In your app's globals.css */
@import '@hki/ui/tokens';
@import '@hki/ui/styles';
```

### Extend Tailwind config

```js
// tailwind.config.js
const sharedConfig = require('@hki/ui/tailwind');

module.exports = {
  ...sharedConfig,
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    '../../packages/ui/**/*.{js,ts,jsx,tsx}',
  ],
};
```

### Import utilities in TypeScript

```tsx
import { cn, brandColors, motion } from '@hki/ui';

// Merge class names
<div className={cn('base-class', condition && 'conditional-class')} />

// Access brand colors
console.log(brandColors.blue[500]); // #2b45c2

// Use motion tokens
const duration = motion.duration.normal; // 200
```

## Brand Colors

### HKI Blue
- Primary brand color
- Trust, stability, enterprise
- Core: `#2b45c2`

### HKI Red
- Secondary brand color
- Energy, urgency, action
- Core: `#dc2626`

## Development

```bash
# From monorepo root
npm run dev --workspace=@hki/ui

# Build the package
npm run build --workspace=@hki/ui
```
