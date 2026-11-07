# Project/progress implementation evidence

Branch: `feat/project-icons-task-progress`, base `d778b70`. No commit, push, real user workspace, authentication or live-cloud operations were performed. Parent-owned `PROJECT-PROGRESS-BRIEF.md` was not edited.

## Automated results

```bash
PATH=/opt/data/cache/scratch/rifttask-pwsh:$PATH \
DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1 \
RIFT_PWSH=/opt/data/cache/scratch/rifttask-pwsh/pwsh npm test
npm run build
git diff --check
```

- Core: **262 passed, 0 failed, 6 optional packaged-artifact checks skipped** (268 declared tests).
- UI: **79 passed, 0 failed**, 10 files.
- Build: passed. Existing Vite large-chunk advisory remains (final main bundle approximately 649 kB before gzip); it is not an error.
- Whitespace: clean.
- New dependency: exact `marked@18.1.3`, Node >=20, installed with scripts disabled; lockfile updated. `npm audit` reports 7 moderate findings in the existing Electron packaging/glob/minimatch dependency chain, not marked. No broad dependency upgrade was attempted.

The new coverage includes optional/legacy field roundtrip, strict invalid image/link/timestamp/count/ID/unknown-field rejection, real-disk store reopening, service backup export/import preserving image bytes, cloud projection and strict remote image-field refusal, exact identity-based local image restore, real-disk manual-cloud pull/rolling backup/conflict/disable via injected transport, icon editing/default rendering, account-scoped independent category disclosure persistence, all-active-project doing filtering/search/project click-through, separate task-description preservation, failed-save drafts and size-limit errors, rich note formatting/security, explicit open/copy, File conversion/preview/removal/enlargement, empty/unsafe-entry refusal, duplicate-add serialization and late-conversion cancellation after composer account/task scope unmount.

### Actual RED → GREEN slices

- `node --test tests/progress.test.cjs`: icon roundtrip initially lost the new icon; after implementation passed. Next progress roundtrip initially dropped the feed; after bounded schema implementation passed. Later malformed HTTP/backslash link cases initially lacked expected rejection; validation was aligned with the native endpoint and passed.
- `node --test tests/progress-cloud.test.cjs`: initially found image bytes in the cloud wire; projection and restore reconciliation made the test pass.
- `npx vitest run src/Progress.test.jsx`: observed missing icon, disclosure, In progress nav and Progress action failures before implementing their respective vertical UI slices. Real File attachment initially had no preview because conversion was not wired; after implementation passed.
- `node --test tests/ipc.test.cjs`: missing `openProgressLink` handler/preload failed before the new narrow endpoint; afterward all IPC tests passed.
- `npx vitest run src/ProgressFeed.test.jsx`: multiline selected list formatting initially prefixed only the first line; implementation now prefixes every selected line and passed.
- Size-error and project-click-through regressions were each observed failing before their fixes. Follow-on coverage additionally verifies existing preservation and security behavior; it is not represented as separately observed RED when it passed on first run.
- The real-browser Write → Preview → Write roundtrip exposed a textarea label lookup that incorporated its remounted content. An explicit accessible Progress note label fixed it; the same browser flow then passed.

## Real browser acceptance (simulated bridge)

A real installed Chromium executed `scripts/progress-browser-smoke.cjs` against the actual React renderer in `docs/previews/project-progress.html`. Its bridge/identity/tasks are explicitly simulated/example data; local fixture saves are captured and run through the real core validator. The preview is session-only. No Electron/native opener, GitHub login or provider transfer is claimed.

Reproduce on this worker (local server only; not publicly exposed):

```bash
npm run dev -- --port 33865 --strictPort
# In a second terminal:
RIFT_PLAYWRIGHT=/opt/data/cache/scratch/rifttask-browser/node_modules/playwright \
RIFT_CHROMIUM=/opt/hermes/tools/chromium-1208/chrome-linux64/chrome \
node scripts/progress-browser-smoke.cjs
```

The Playwright package is installed only in scratch, not added to app dependencies. The server used for this run was stopped afterward.

Observed results:

- Project icon changed via the real edit form and appeared in the saved header/sidebar.
- Two doing tasks from separate active projects; one independently collapsed sidebar category.
- A real `tests/fixtures/progress-playtest.png` File upload decoded and re-encoded through the browser canvas. The saved/displayed raster decoded at **720 × 400**. No canvas/Image mocks in this acceptance run.
- Bold heading/text, bullets and inline code rendered; a distinct hostname/URL card and local thumbnail appeared in dark and light mode. Enlarging the thumbnail displayed the real raster in-app.
- Unsafe HTML, Markdown remote images and javascript/data/file links in Preview produced **no active image/script/link nodes**, **no external requests** and **no script execution**.
- Explicit Open invoked the simulated bridge **exactly once**; Copy populated the isolated browser's actual clipboard. Confirmed deletion removed the saved entry.
- **No page errors; no external requests** across the acceptance flow.

### Inspected screenshots

All files are actual current renderer captures using example data, not generated UI mockups. They were visually inspected for readable text, matching icons, theme contrast, distinct URL controls and valid raster thumbnails.

Directory: `/opt/data/projects/RiftTask/artifacts/screenshots/project-progress/`

- `projects-dark.png`
- `project-tasks-dark.png`
- `in-progress-dark.png`
- `rich-progress-dark.png`
- `image-enlarged.png`
- `in-progress-light.png`
- `rich-progress-light.png`

The same directory contains `browser-result.json` and a core-validated synthetic `browser-workspace.json`. These evidence artifacts live under the existing ignored artifacts directory; a parent publishing screenshots must explicitly select/force-add the intended evidence files. The reusable HTML harness, test PNG and smoke script are not ignored.

## Limits and remaining acceptance

- No actual native Windows/macOS run, OS external-browser launch, signed package/installer acceptance or live cross-device cloud transfer was performed here. Existing PowerShell installer fixtures ran as part of the core suite; those are not native Windows execution.
- Native local persistence/export/import was exercised through production service/store modules with scratch disk paths, not the user's Electron userData.
- Cloud behavior was exercised through production canonical projection/runtime and injected transport; no real task data or remote Contents calls.
- Images are intentionally local-only. Cloud contains progress Markdown/links/icons/counts, never image bytes/names/IDs. A receiving device shows unavailable image counts; full backups retain binaries.
- Independent review is still for the parent before publication; this implementation worker did self-review, targeted security scans, regression/build checks and browser QA, but does not claim an independent approval.
