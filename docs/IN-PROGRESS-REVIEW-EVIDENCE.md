# PR11 follow-up: global In progress, category filter, In review

## Verified source behavior

- Global In progress shows only `doing` tasks in active projects, independent of `today` or due date. All categories is default; specific/empty categories combine with existing search and project links. Selection is renderer-only, resets on account change and falls back when a restored/refreshed workspace removes the category.
- Shared row/editor/board stage order: backlog → doing → review → done. Four board columns retain the existing dark/lime design, with horizontal board scrolling on narrow screens. Review is not completed, does not appear in global In progress, and has a separate nonzero project-tile count. Done alone sets completedAt; leaving Done clears it. No stage cycling/progress-percentage mechanism existed to update.
- `review` passes the existing core validator, real temporary account-store restart/rolling backup, native-service export/import and canonical cloud projection/restore. Rich progress, icons, local attachments and local paths remain intact; only the existing cloud-safe projection travels. Unknown status/remote fields still fail closed. Exact legacy `next` remains losslessly normalized.
- Package and both root lock metadata versions are 0.2.0. Workspace/envelope version remains 1. Update all clients before syncing review tasks; 0.1.1 rejects the new enum. No silent downgrade or cloud-format migration.

## Actual RED → GREEN evidence

Evidence directory: `/opt/data/output/rifttask/in-progress-review/`.

| Slice | Observed RED | Verified GREEN |
| --- | --- | --- |
| Global category filter | `category-red.log`: missing Filter by category; 1 failed | `category-green.log`: 1 passed |
| Real review persistence/backup/cloud | `review-core-red.log`: Invalid workspace: enum; 1 failed | `review-core-green.log`: 1 passed |
| Review row/editor/board transitions | `review-ui-red.log`: missing In review column; 1 failed, 1 passed | `review-ui-green.log`: 2 passed |
| 0.2.0 metadata | `version-red.log`: 0.1.1 !== 0.2.0 | final full core suite passes metadata assertion |
| Separate project review count | `counts-red.log`: missing In review count; 1 failed, 2 passed | `counts-green.log`: 4 passed, including additional restore/account-reset regression |

The initial new cloud assertion expected a byte-identical object after restore; the existing projector legitimately adds `imageCount:1`. The test now asserts the complete expected workspace including that known metadata, without dropping any fields/assertions. The board test scope was narrowed to the Tasks tabpanel so the retained Project terminal region is not mistaken for a board column.

Final commands (serial tests then build, CPU 0):

```sh
RIFT_PWSH=/opt/data/cache/scratch/rifttask-pwsh/pwsh \
DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1 taskset -c 0 npm test
taskset -c 0 npm run build
RIFT_SCREENSHOT_OUTPUT=/opt/data/output/rifttask/in-progress-review/screenshots \
taskset -c 0 node scripts/progress-browser-smoke.cjs
```

- `full-test.log`: **275 core tests: 268 passed, 7 skipped, 0 failed**; **84 renderer tests passed in 12 files**. Skips are the opt-in real packaged-app icon/archive fixtures, not PowerShell installer fixtures; those executed successfully using the supplied PowerShell runtime.
- `build.log`: successful production build, 28 modules. Existing >500 kB chunk warning remains (650.25 kB JS); no threshold was weakened.
- `browser.log` / `screenshots/browser-result.json`: real Chromium renderer with simulated identity/bridge and synthetic tasks; zero external requests and page errors. Actual file upload/canvas raster decode 720×400, safe Markdown, explicit opener/clipboard, image enlargement/deletion and icon editing all verified. Category task counts are 2 / 1 / 0. Review is read back from bridge storage and core-validated, preserving its legacy pin and null completion time.

## Screenshots and fingerprints

`screenshots/` contains **20 matrix screenshots**: global All/specific/empty, four-column board with task in review, and editor set to review; each in dark/light at 1024/1440. Seven existing rich-progress/icon/image smoke screenshots were regenerated too. `review-workspace.json` captures the synthetic persisted `review` enum; `browser-workspace.json` captures rich progress with the real uploaded fixture image.

Inspected dark 1440 board/editor, dark 1024 global All, light 1024 board, and light 1440 empty-state screenshots. At 1024 the board intentionally scrolls horizontally (190px column minimum); the review stage and labels remain readable. Global filters fit without overflow. No visual redesign.

`source-fingerprints.json` records SHA-256 for modified/new source and every screenshot, with the inherited HEAD identifier. `working-tree.diff` captures the tracked patch. These artifacts contain synthetic data only.

## Parent verification and independent review

The parent independently completed the full core suite with PowerShell fixtures enabled: **268 passed / 7 opt-in packaging skips / 0 failed**. The interrupted first renderer run was not counted as complete; a fresh full renderer run passed **84/84 tests in 12 files**, followed by a successful production build. Logs: `parent-tests.log`, `parent-ui.log`, `parent-build.log`. Read-only independent review `deleg_55112de4` found no blocking security or logic issues and separately exercised schema/cloud/legacy/version assertions. Parent inspected the category-filter and four-column board screenshots.

## Limits and owner handoff

No commit, push, merge, release, live-account/auth/config read/write, real cloud operation or denied `.local` deletion. Actual Electron/native Windows/macOS installation and live two-device sync remain owner acceptance checks, not claims from browser simulation. Parent should independently review this working tree, then update existing PR11 rather than create a duplicate PR. Before cloud testing review, update every client to 0.2.0-capable source and use dummy data. Confirm stage restart/backup fidelity, manual sync conflict safety, and no attachment binaries on the receiving device.
