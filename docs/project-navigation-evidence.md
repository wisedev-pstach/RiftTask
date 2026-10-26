# Project-first navigation — renderer evidence

Scope: `src/App.jsx`, `src/App.test.jsx`, `src/styles.css`, and this evidence file. Read `AGENTS.md` and the user-edited `docs/BUILD-STATE.md` before changes; did not modify BUILD-STATE. No commits, pushes, remote writes, auth changes, backend/schema/IPC changes or cloud implementation.

## Delivered

- Default Projects overview is a grid of project tiles, not a mixed-project task list. Category buttons filter tiles to that category.
- Every active project tile displays explicit In progress (`doing`) and To do (`backlog`) counts, including zero. Done tasks do not inflate either count. Counts derive from the current bridge-returned workspace, not fixtures, search results, or a separate cached counter.
- Tile entry and sidebar project navigation show only that project's tasks. Search resets between project contexts. Today remains an explicit secondary cross-project view.
- Real Tasks / Project details tabs, including arrow/Home/End keyboard navigation. Repository, edit, local Git status and the **Open external terminal (interim)** launcher live in Project details. The UI explicitly says the embedded terminal is not implemented; there are no pretend Milestones or embedded-terminal tabs.
- Successful task creation from overview opens the task's chosen project. CRUD, status changes, notes/priority/dates/Today, board/list, search, archive/restore, backup consent/import, account disconnect/reconnect, load recovery, and session-only preview remain covered.
- Project routes are namespaced independently of imported IDs: valid IDs `all` and `today` cannot hijack overview/Today routes or leak another project's tasks.

## Actual vertical RED → GREEN tracer bullets

Each numbered slice was tested failing before its production change, then rerun passing before the next implementation slice. Commands ran from `/opt/data/projects/RiftTask` using installed Vitest 5.0.5.

1. **Default tiles and zero/status counts**
   - RED: `npm run test:ui -- -t 'defaults to project tiles'` — exit 1, 1 failed / 18 skipped; missing Projects heading (old mixed task list).
   - First implementation rerun exposed concatenated accessible tile names (`lose.DOTIn progress 1To do 1`); inserted real text spacing, not a weakened assertion.
   - GREEN: same command — exit 0, 1 passed / 18 skipped. Two projects show 1/1 and 0/0; done is excluded and task rows are absent from overview.
2. **Category navigation and isolated project entry**
   - RED: `npm run test:ui -- -t 'filters category tiles'` — exit 1, 1 failed / 19 skipped; no Games category navigation button.
   - Added category routes/buttons and filtered overview; reset search when changing navigation context.
   - GREEN: `npm run test:ui -- -t 'filters category tiles|defaults to project tiles'` — exit 0, 2 passed / 18 skipped. Both category filtering and two-project isolation verified through UI actions.
   - Updated existing tests to enter a project when testing tasks, and to expect the intended Projects default.
   - Regression RED: `npm run test:ui -- --reporter=dot` — exit 1, 19 passed / 1 failed; existing load-recovery test found the overview had hidden the error and retry control.
   - Moved workspace notices/errors/loading/retry outside the task-only surface. GREEN: same command — exit 0, 20 passed.
3. **Honest project feature tabs**
   - RED: `npm run test:ui -- -t 'offers real Tasks'` — exit 1, 1 failed / 20 skipped; Tasks tab missing.
   - Added real task/detail panels; moved integrations into details and labeled the external terminal interim. Updated existing native-action/Git/archive/project-edit tests to select Project details first.
   - GREEN: same targeted command — exit 0, 1 passed / 20 skipped. Full `npm run test:ui -- --reporter=dot` — exit 0, 21 passed.
4. **Task save → chosen project → live counts**
   - RED: `npm run test:ui -- -t 'opens the saved task project'` — exit 1, 1 failed / 21 skipped; task saved but overview never entered Other project.
   - Added navigation to the saved task's project when outside its task surface, retaining the deliberate secondary Today context.
   - GREEN: same command — exit 0, 1 passed / 21 skipped. Full dot reporter — exit 0, 22 passed. Test exercises backlog creation, row change to doing, form change to done, and checks tile counts at each return to overview; the other project stays at zero.
5. **Tile layout and discoverable categories**
   - RED: `npm run test:ui -- -t 'keeps project tiles in a wrapping grid'` — exit 1, 1 failed / 22 skipped; grid style absent.
   - Added responsive wrapping tiles, visible category navigation (the existing edit-button hover rule must not hide the new category selector), feature tabs and details styling.
   - GREEN: same command — exit 0, 1 passed / 22 skipped. CSSOM assertions verify grid display, wrapping tile text and non-hover category visibility; this is not a native visual smoke test.
6. **Keyboard feature-tab navigation**
   - RED: `npm run test:ui -- -t 'supports keyboard navigation'` — exit 1, 1 failed / 25 skipped; ArrowRight left focus on Tasks.
   - Added roving tab indices and arrow/Home/End handling for the two real tabs.
   - GREEN: same command — exit 0, 1 passed / 25 skipped. Full dot reporter — exit 0, 26 passed.
7. **Imported route-name IDs must remain isolated**
   - RED: `npm run test:ui -- -t 'isolates projects whose imported identifiers'` — exit 1, 1 failed / 26 skipped; a project with ID `all` replaced the default Projects heading.
   - Namespaced project navigation routes, lookup and active markers; preserved original workspace identifiers and bridge arguments unchanged.
   - GREEN: same command — exit 0, 1 passed / 26 skipped. Test also opens project ID `today` without showing another project's Today-pinned task.

## Additional regression coverage (already-green inherited paths)

`npm run test:ui -- -t 'reloads overview counts|excludes archived projects'` — exit 0, 2 passed / 23 skipped on first execution; no production change needed for these established bridge/archive paths, so these are **coverage checks, not claimed RED cycles**.

- Stateful promise-based test bridge: save a doing task in project B, unmount/remount the actual App, reload through `bridge.load()`, assert B's count is 1 and overview is default. Disconnect from searched Project details, sign into a different account workspace, verify no old project/tab/search leaks. This proves renderer behavior at the bridge boundary, **not real disk or cross-device persistence**.
- Archived projects absent from root/category tiles, task project selector and Today; restoring makes their actual task count visible without deleting tasks.
- Extended existing failed-status-save regression to check tile counts remain based on persisted doing status after rejection.
- Extended existing backup-consent/import regression to verify import returns to Projects overview with restored counts and no stale feature tabs.

## Final verification

- `npm run test:ui` — exit 0: **27 passed, 0 failures, 0 skips**, 1 test file (final run after route hardening).
- `npm run build` — exit 0: Vite 8.3.5 production build, 16 modules transformed; final output `dist/assets/index-Cz8bWmpA.js` 238.34 kB and CSS 11.44 kB. Build output is generated/ignored, not source edits.
- `git diff --check` — exit 0, no whitespace errors.

## Limitations / handoff

No cloud sync, milestones, embedded PTY, native terminal execution or native-platform validation delivered or claimed. Preview remains explicitly session-only. Native actions are tested via promise-based bridge doubles, not OS windows. This slice did not capture screenshots: work was restricted to renderer sources and this evidence document; parent should capture current real preview screenshots separately under ignored screenshot artifacts before its progress update. Existing user BUILD-STATE edit is preserved. The parent owns cloud-policy work independently.

An attempted Python batch helper and a shell/Python log-truncation helper were blocked by unattended tool approval policy; neither executed or changed files. Continued with ordinary patch and direct test commands; no blocker remains for renderer tests/build.
