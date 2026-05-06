# /quality — Code Quality Review

Perform a focused code quality review of all files changed on the current branch vs `main`. Evaluate each file across three lenses: **maintainability**, **modularity**, and **performance**. Then report findings and fix the issues you can fix automatically.

## Steps

### 1. Identify changed files
```bash
git diff --name-only main...HEAD
```
Filter to `.ts` and `.tsx` files only.

### 2. For each changed file, evaluate:

**Maintainability**
- File length > 300 lines (excluding blanks/comments) — flag, suggest split point
- Function/component length > 80 lines — flag, note which function
- Cyclomatic complexity > 15 (deeply nested ifs/switches/loops) — flag
- Magic numbers or string literals that should be named constants — flag
- Commented-out code — flag for removal

**Modularity**
- God components: a single component doing data-fetching + business logic + rendering — suggest extracting a hook or splitting into container/presenter
- Prop drilling more than 2 levels deep — suggest context or co-location
- Circular or tangled imports — flag any `import` that crosses clean layer boundaries (e.g., server code importing client, shared importing agentic-specific)
- Re-exported symbols that are never consumed — flag dead exports

**Performance (React)**
- Inline object/array literals passed as JSX props (`<Comp style={{ margin: 0 }}`) — flag, suggest `useMemo` or move outside component
- Inline arrow functions in JSX props on non-DOM components (`<Comp onClick={() => ...}`) — flag, suggest `useCallback`
- Missing dependency arrays on `useEffect`/`useMemo`/`useCallback`
- Large imports from barrel files where a direct import would tree-shake better (`import { X } from "@hki/ui"` when `"@hki/ui/components/X"` exists)

### 3. Run static checks
```bash
pnpm format:check 2>&1 | head -30
pnpm typecheck 2>&1 | tail -20
```

### 4. Auto-fix what you can
- Run `pnpm exec prettier --write` on files with formatting violations
- Remove commented-out code blocks that are clearly dead
- Replace magic literals with named constants where the intent is unambiguous

### 5. Report

Produce a table per file:

| File | Issue | Lens | Severity | Action |
|------|-------|------|----------|--------|
| path/to/file.tsx | Component >300 lines | Maintainability | ⚠ Warn | Suggest split |
| path/to/file.tsx | Inline style object prop | Performance | ⚠ Warn | Auto-fixed |

Then give an overall health summary:
- **Maintainability**: X issues (Y auto-fixed)
- **Modularity**: X issues
- **Performance**: X issues (Y auto-fixed)
- **Next steps**: top 3 highest-value manual refactors

Keep the report concise. Do not list issues that are already handled by ESLint rules (no-unused-vars, import/order, etc.) — those are enforced at commit time.
