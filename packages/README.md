# Shared Packages

This directory contains shared frontend packages used across multiple applications in the monorepo.

## Packages

### [@hki/chat](./chat)

Shared React components and hooks for chat interfaces.

**What's included:**

- Chat UI components (MessageList, ChatContainer, MessageInput)
- Custom hooks (useChat, useMessages, useTypingIndicator)
- tRPC and WebSocket adapters
- TypeScript type definitions

**Used by:** `apps/ai-platform/agentic`, `apps/ci-portal`

### [@hki/ui](./ui)

Production-ready component library built with Tailwind CSS and Radix UI.

**What's included:**

- 50+ accessible React components (Button, Card, Dialog, etc.)
- Complete design token system (primitives, semantic)
- Agentic theme for AI Platform
- Glass effect styles for modern UI
- Storybook documentation
- Exportable Tailwind config

**Used by:** `apps/ai-platform/agentic`, `apps/ci-portal`, `@hki/chat`

### [@hki/typescript-config](./typescript-config)

Shared TypeScript configurations for consistency across all TypeScript projects.

**Configurations:**

- `base.json` - Base config for all projects
- `nextjs.json` - Next.js specific settings
- `react-library.json` - React library config

**Used by:** All TypeScript apps and packages

### [@hki/eslint-config](./eslint-config)

Shared ESLint rules and configurations for code quality.

**Used by:** All TypeScript/JavaScript apps and packages

## Development

### Installing Dependencies

```bash
# Install all dependencies for the monorepo
pnpm install
```

### Building Packages

```bash
# Build all packages
pnpm run build

# Build specific package
turbo run build --filter=@hki/ui

# Build packages in watch mode
cd packages/ui && pnpm run dev
```

### Using Packages in Apps

Packages are referenced using the `workspace:*` protocol in `package.json`:

```json
{
  "dependencies": {
    "@hki/chat": "workspace:*",
    "@hki/ui": "workspace:*",
    "@hki/typescript-config": "workspace:*"
  }
}
```

### Package Structure

Each package follows this structure:

```
package/
├── src/              # Source code
├── dist/             # Built output (gitignored)
├── package.json      # Package configuration
├── tsconfig.json     # TypeScript config
├── tsup.config.ts    # Build config (tsup)
└── README.md         # Package documentation
```

## Monorepo Setup

This monorepo uses:

- **pnpm workspaces** - Package management and linking
- **Turbo** - Build system with caching and parallel execution
- **tsup** - TypeScript package bundler

See the root `pnpm-workspace.yaml` and `turbo.json` for configuration.

## Notes

- All packages are currently `private: true` (not published to npm)
- Packages are built before apps that depend on them (via `dependsOn: ["^build"]` in turbo.json)
- Shared packages reduce code duplication and ensure consistency across apps
