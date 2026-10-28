# Project milestones — 28 October 2026

## Delivered
- Project-scoped label create/edit (name/color), task assignment/unassignment, label badges in list/board and a Milestones feature tab showing assigned tasks and live done/total counts. Tasks / Milestones / Project details keyboard navigation retains Home/End and wrapped arrow keys.
- Optional additive version-1 `milestones:[{id,projectId,name,color}]` and task `milestoneId` (`''` unassigned). Old workspaces without either stay valid without eager rewriting; an edit with no assignment preserves a previously absent task field. Unique safe IDs, project references, same-project assignment, name/color/count/total-size validation. No label delete UI in this bounded slice.
- Canonical cloud projection/restore preserves labels and assignments while still stripping device paths and preserving local mappings. Consent field disclosure explicitly includes milestone labels/task assignments. Existing unknown-field rejection remains; older cloud clients reject unsupported milestone snapshots rather than strip data.

## Observed tests and failures
1. `node --test tests/milestones.test.cjs`: RED 0/2: validator dropped labels/assignment and accepted invalid references. Minimal validator extension: GREEN 2/2.
2. Existing cloud snapshot suite exposed its now-obsolete assumption that root `milestones:[]` is unsupported. Updated that generic future-field test to use genuinely unsupported fields; no weakening of unknown-field protection.
3. `npx vitest run src/Milestones.test.jsx --reporter=dot`: RED missing Milestones tab; implemented actual form/assignment/tab/workflow: GREEN 1/1.
4. Full suite initially exposed two old two-tab assertions plus empty `milestoneId` insertion in unchanged legacy tasks. Updated tab contract assertions and fixed legacy-field stability; full suite GREEN.
5. Added milestone field disclosure assertion to cloud consent test: RED missing text, then minimal disclosure update GREEN.
6. Supplemental verification (existing behavior; no production changes): real scratch-file store restart, rolling backup, cloud projection/restore and old-v1 compatibility; renderer changing task project clears the previous assignment and restricts options to the selected project.
7. Final independent read-only reviewer reran `npm test && npm run build && git diff --check`: **101 core/integration + 34 UI tests PASS**, build PASS (17 modules), whitespace PASS. Parent preceding full run passed 101 + 33 before the final additional project-switch test. Core syntax check also passed.

## Review
Two independent read-only reviews found no concrete blockers. Initial reviewer suggested dedicated milestone cloud/store and project-switch tests; those were added and passed in the final review. No reviewer changed source, remote state or authentication.

## Real browser verification
Ran `node /opt/data/cache/scratch/rifttask-milestones-smoke.cjs` against temporary loopback Vite port 5198 with installed local Chromium/Playwright. Actual renderer interactions created an example category/project, milestone and three assigned tasks (done/doing/backlog), verified `1 / 3 done`, then displayed the three-column board. Zero page errors. An initial Playwright exact-label locator timed out because browser label matching included option text; reran successfully with explicit named select locators. No production change was needed for that locator issue.

Current screenshots captured and visually inspected at 1440×960:
- `artifacts/screenshots/milestones-20261028/milestones-preview.png`
- `artifacts/screenshots/milestones-20261028/board-preview.png`

Visible banner: BROWSER PREVIEW / EXAMPLE DATA / session only; no native Electron or real cloud transfer. These demonstrate renderer appearance and interactions, not native Electron persistence, native installers or real cross-device cloud. Temporary preview server stopped before delivery.

## Boundaries
No actual user data, data repository or external snapshot read/write. No paid service, deployment, auth/scope changes, issues import, main merge, release, workflow bypass or native-platform claims. Real manual cloud external acceptance still requires authorization. Genuine retained embedded PTY remains next; no PTY scaffolding added in this pass. Source remains on private feature branch with draft PR; exact remote delivery SHA is verified and reported separately.
