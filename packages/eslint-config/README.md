# @hki/eslint-config

Shared ESLint configurations for the HKI AI Platform monorepo.

## Configurations

### `base`
Base configuration with TypeScript and import sorting rules.

### `next`
Configuration for Next.js applications. Extends `base` with React and React Hooks rules.

### `react-library`
Configuration for React component libraries. Extends `base` with library-specific rules.

## Usage

### In a Next.js App

Create `eslint.config.js`:

```javascript
import config from "@hki/eslint-config/next";

export default [
  ...config,
  {
    ignores: [".next/*"],
  },
];
```

Or use legacy `.eslintrc.js`:

```javascript
module.exports = {
  extends: ["@hki/eslint-config/next"],
  rules: {
    // Your custom rules
  },
};
```

### In a React Library

```javascript
module.exports = {
  extends: ["@hki/eslint-config/react-library"],
  rules: {
    // Your custom rules
  },
};
```

## Rules Overview

### Base Rules
- TypeScript strict mode with unused variable warnings
- Consistent type imports
- Import sorting and organization
- No console (except warn/error)

### React Rules
- React hooks rules enforcement
- JSX key requirements
- Self-closing component enforcement
- No default exports in libraries (encouraged named exports)
