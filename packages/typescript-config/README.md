# @hki/typescript-config

Shared TypeScript configurations for the HKI AI Platform monorepo.

## Configurations

### `base.json`
Base configuration with strict settings for all TypeScript projects.

### `nextjs.json`
Configuration for Next.js applications. Extends `base.json` with Next.js-specific settings.

### `react-library.json`
Configuration for React component libraries. Extends `base.json` with JSX and bundler settings.

## Usage

### In a Next.js App

```json
{
  "extends": "@hki/typescript-config/nextjs.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### In a React Library

```json
{
  "extends": "@hki/typescript-config/react-library.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```
