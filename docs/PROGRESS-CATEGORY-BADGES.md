# In progress category badges — 0.3.1

## Scope
Global **In progress** task cards now show a noninteractive category text pill, color dot and restrained color tint beside the existing project button in Board and List. Category is derived on render from the task's live project `categoryId` and current workspace categories, including after restored snapshots or project reassignment. Missing category lookup omits the pill; orphan/archived-project tasks retain the existing exclusion rules. No task/category copy, persisted field, schema, cloud behavior, filter semantics or four-stage workflow changed. Project and milestone views do not gain badges.

Text uses theme `--ink`, not category color. White colors remain readable; long/unbroken category names wrap inside the card without hiding status/edit/project/progress controls. Category is not a new navigation/filter button. Existing typography, spacing, surfaces and restrained pill styling preserve the Operate composition. Self-audit: no new decorative rails, gradients, icons, hero or layout redesign.

## Reproducible execution
Evidence directory: `/opt/data/output/rifttask/progress-category-badges/`.

| Gate | Actual result | Evidence |
| --- | --- | --- |
| `taskset -c 0 npm run test:ui -- src/Workflow.test.jsx` before production | **RED:** 2 missing-category failures, 4 existing passes | `ui-red.log` |
| Same targeted command after UI implementation | **GREEN:** 6 passed | `ui-green.log` |
| `taskset -c 0 node --test tests/cloud-compatibility.test.cjs` before metadata bump | **RED:** expected 0.3.1, actual 0.3.0; 5 passed/1 failed | `metadata-red.log` |
| `RIFT_PWSH=/opt/data/cache/scratch/rifttask-pwsh/pwsh DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1 taskset -c 0 npm test` | Core: 282 tests, **275 passed, 7 skipped, 0 failures**. UI: **98 passed in 13 files**. Includes metadata GREEN and 8 Workflow tests (restore/reassignment/long white name/missing lookup/project-view regressions added after the first tracer). | `full-test.log` |
| `taskset -c 0 npm run build` | **Passed**, 29 modules; existing >500 kB chunk-size advisory remains | `build.log` |
| `RIFT_SCREENSHOT_OUTPUT=/opt/data/output/rifttask/progress-category-badges node scripts/category-badges-browser-smoke.cjs` with local Vite on 33865 | **16 fresh screenshots**, zero simulated saves, zero page errors, zero external requests. All card controls hit-tested and contained; no badge overflow. Minimum measured text contrast **9.5486:1**. | `category-browser.log`, `category-browser-result.json` |
| `RIFT_SCREENSHOT_OUTPUT=/opt/data/output/rifttask/progress-category-badges/regression node scripts/progress-browser-smoke.cjs` | **Passed** existing rich progress/upload/canvas/clipboard/XSS/filter/four-stage/review persistence regression | `progress-browser.log`, `regression/browser-result.json` |
| `git diff --check` | **Passed** | final local diff |

Browser acceptance uses the existing synthetic `docs/previews/project-progress.html` session-only bridge, not real user content/accounts. The supplemental harness intercepts only the fixture response to supply long white-color category names. Its initial stress run revealed Vite's separate transformed HTML-proxy script; matching that response fixed the harness and the entire matrix was rerun successfully. No production fix was necessary for stress layout.

## Current screenshots
All files are under the evidence directory. Full matrix: `in-progress-{board,list}-{dark,light}-{1440,1024}.png`, plus the same eight with `-long-white` before `.png`. `sha256.json` fingerprints all 16 screenshots and the generated `dist/index.html`.

Visually inspected representative captures:
- `in-progress-board-dark-1440.png`: Games/Tools pills beside distinct project buttons; all four columns retained.
- `in-progress-board-light-1024-long-white.png`: long white category pills wrap with readable dark ink; task controls remain separate and visible. Existing horizontally scrollable four-column board behavior is unchanged.
- `in-progress-list-light-1440.png`: compact category/project metadata row below each title.
- `in-progress-list-dark-1024-long-white.png`: long category context stays contained with progress/status controls unobstructed.

These are current Chromium renderer previews, **not native Electron, disk-persistence or live-cloud evidence**. Existing seven conditional native/archive tests remain skipped; no native installers were run. No commit, push, merge, release, deployment or live-account action performed.
