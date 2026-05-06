# /quality — Code Quality Review

Review the current branch's changed files for maintainability, modularity, and performance. No arguments needed; runs against the current working tree.

---

## Steps

### 1. Gather scope

```bash
git diff --name-only main...HEAD 2>/dev/null || git status --porcelain
```

Filter to `.ts`, `.tsx`, `.js`, `.jsx` files.

### 2. Automated checks

Run these — failures are findings, not blockers:

```bash
pnpm typecheck 2>&1 | head -60
pnpm lint 2>&1 | head -80
```

### 3. Manual review per changed file

**Modularity**
- File > 300 lines (excl. blanks/comments): doing too many things — split it
- Circular imports (A imports B imports A)
- Imports from > 5 internal packages: coupling smell
- Barrel `index.ts` that hides deep coupling

**Maintainability**
- Functions > 80 lines: extract
- Nesting depth > 4 levels (if/switch/ternary): simplify
- Magic numbers/strings not in constants
- Duplicated logic that belongs in a shared util
- Unnarrowed `any` types
- List every TODO/FIXME/HACK with `file:line`

**Performance — React**
- Inline arrow functions as props `onClick={() => ...}` → `useCallback`
- Inline object/array literals in JSX `style={{ }}` / `value={[]}` → `useMemo`
- Missing `useMemo` on sort/filter/map derivations
- Missing `React.memo` on stable pure components
- `useEffect` with stale or missing deps

**Performance — Server/Node**
- `await db.*` inside a loop → batch query
- Repeated identical fetches without caching
- Sync `fs`/`crypto` calls in request handlers

---

## Output format

```
## Quality Review — <branch or "working tree">

### Summary
<2-3 sentence overall assessment>

### Automated findings
<ESLint/TS errors and warnings, grouped by file>

### Manual findings

#### <file-path>
- [MODULARITY] <finding>
- [MAINTAINABILITY] <finding>
- [PERFORMANCE] <finding>

### TODO/FIXME inventory
file:line — comment text

### Recommended actions (priority order)
1. highest-impact fix
2. ...
```

Prioritize: errors > warnings > style. Skip files with no findings.
