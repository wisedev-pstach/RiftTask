# Three-status renderer evidence

Scope: renderer only (`src/**`) plus this evidence file. Read `AGENTS.md` and latest authoritative priorities in `docs/BUILD-STATE.md`. No cloud, milestones, project tabs, embedded terminal, auth, network, commits or pushes in this slice. Backend agent owns legacy `next` → `backlog` normalization; renderer does not duplicate migration.

## Strict vertical TDD

### 1. Ordered status controls and lossless transitions

- Added behavioral test `offers only the three ordered statuses in rows and task forms while preserving fields through transitions` before production changes.
- RED: `npm run test:ui -- -t 'offers only the three ordered statuses'` exited 1: actual row options included the unwanted `next` / `Up next` option.
- Minimal implementation: removed `next` from the shared renderer status map. Rows, new-task form, task editor and board all use this map.
- GREEN: same targeted command exited 0 (1 passed, 15 skipped). `npm run test:ui` exited 0 (16 passed).
- Assertions require exactly ordered `(backlog, Backlog)`, `(doing, In progress)`, `(done, Done)` pairs in list rows and both forms; new tasks default to backlog. Existing full-task creation regression remains passing.
- Exercises editor backlog → doing, row doing → done, completed-task editor save and row done → backlog. Exact full-task equality proves ID, project, title, notes, priority, due date, Today flag and creation timestamp are preserved; completion timestamps are created, preserved on editor save, and cleared on reopen.

### 2. Three board columns and task movement

- Added `renders exactly three ordered board regions on a three-column grid and moves tasks without losing fields` before CSS changes.
- Test harness corrections before valid RED: Vitest CSS raw import was empty, making computed grid return `none` and CSSOM rule lookup undefined. Import-meta URL resolved to a non-file URL in the test environment. Switched test-only stylesheet loading to `node:fs` `readFileSync('src/styles.css','utf8')`; production renderer has no Node import. CSS assertions use the actual parsed CSSOM, not jsdom layout/painting.
- Verified valid RED: `npm run test:ui -- -t 'renders exactly three ordered board regions'` exited 1: expected `repeat(3,minmax(190px,1fr))`, received `repeat(4,minmax(190px,1fr))`.
- Minimal implementation: changed board grid repeat count from 4 to 3.
- GREEN: same command exited 0 (1 passed, 16 skipped); `npm run test:ui` exited 0 (17 passed).
- Checks exactly three ordered accessible regions, correct initial task membership, exactly ordered backlog/doing/done values in every board row, and moving a task from Backlog to In progress with every other task field and unrelated tasks unchanged.

### 3. Active column marker

- Added `marks only the In progress board heading as active` before selector changes. It parses actual stylesheet marker selectors and matches them against the real rendered board headings; jsdom cannot paint pseudo-elements.
- RED: `npm run test:ui -- -t 'marks only the In progress board heading'` exited 1: marked region was `Done`, expected `In progress`.
- Minimal implementation: changed marker selector from `.board-column:nth-child(3)` to `.board-column:nth-child(2)`.
- GREEN: same command exited 0 (1 passed, 17 skipped); `npm run test:ui` exited 0 (18 passed).

## Final verification

- `npm test`: exited 0; 69 core/integration tests and 18 renderer tests passed, no failures/skips in the full suites. Core count includes concurrent backend agent's migration work; no backend files edited by this renderer agent.
- `npm run build`: exited 0; Vite production build succeeded (16 modules transformed).
- `git diff --check`: exited 0, clean.
- Changed by this agent: `src/App.jsx`, `src/App.test.jsx`, `src/styles.css`, `docs/status-ui-evidence.md`.
- Concurrent backend changes observed in `desktop/core.cjs`, `tests/core.test.cjs`, `tests/store.test.cjs`; left untouched.
- Automated DOM and CSSOM evidence only; no new screenshot or native Electron/Windows/macOS visual execution claimed.
