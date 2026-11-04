# Compact workspace UI — execution evidence

## Delivered
- Primary surface: operate; secondary: configure. Graphite neutrals, RiftCode-family lime (#c8ff63 in dark mode), deliberately selected Segoe/local system typography, restrained 24px titles, borders instead of decorative glass/cards.
- Actual `./icon.svg` asset used in sidebar and sign-in, resolving beside the packaged file document. Parent reproduced the absolute-path failure, fixed both references and added signed-in/signed-out regressions.
- Dedicated Settings → Appearance / Cloud / Account & backups. Removed project-header Cloud persistence toggle and sidebar backup/account-action clutter.
- Single lazy cloud component retained through Settings/tab/workspace navigation, so pending operations do not strand the global write lock or duplicate paragraphs. Cloud remains manual, plaintext/history warnings stay visible, secondary privacy/repository details are collapsible. Verification, exact repository-ID consent, conflict state, exact-revision download confirmation and local configuration reset remain intact.
- Safe device-local System/Light/Dark preference; handles invalid values, unavailable storage, system changes and listener cleanup. Terminal colors update through xterm options without restarting the retained shell. Opening Settings hides rather than unmounts the terminal dock.
- Compact 220px sidebar, measured 30px category / 32px project rows, 4px section gaps, denser task rows and project tiles. Shorter sign-in/header copy retains authentication pending/help/warnings and backup recovery.

## Test evidence
New dedicated-settings/theme tests initially failed because Settings was missing and the old Cloud persistence button remained. Initial command: `npm run test:ui -- src/Settings.test.jsx` (3 failed), then green after implementation.

Terminal contrast regression initially failed with the prior hard-coded #0c1016/#d5dce8 theme. Focused command: `npm run test:ui -- src/TerminalDock.test.jsx -t 'updates terminal contrast'`; failed before implementation, passed after instance-option updates.

Cloud loading test initially failed because the UI immediately claimed Cloud off and had no loading status. Focused command: `npm run test:ui -- src/CloudPanel.test.jsx -t 'shows configuration loading'`; failed before implementation, passed after explicit loading state.

Final suites: core **190 passed, 7 environment-gated skips**, renderer **56 passed across 6 files**, no failures. The parent's last combined command reached its tool time limit after core passed; renderer was rerun separately and passed. Build and browser capture were rerun successfully afterward.

Independent review reproduced cloud actions releasing the initial-load lock. A deferred-load regression failed before `disabled={saving||connecting||!workspace}` and passed afterward; failed-load backup import still works. Settings tabs now have tested roving focus, Arrow/Home/End handling and linked tabpanels.

Parent separately passed all five real Windows/macOS x64/ARM64 and Linux archive cases, then rebuilt `/opt/data/cache/scratch/rifttask-compact-ui-package/linux-unpacked/resources/app.asar` and passed icon archive byte checks plus Python icon-format decoding. Native target-OS rendering is not established by these checks.

Existing UI behavior assertions were retained; backup/disconnect/cloud entry paths were updated to use Settings. Added repeated navigation, pending-hidden cloud operation/unlock, project return, appearance persistence/reload both modes, invalid/blocked storage, live system changes/cleanup, exact download revision, stale account unmount result, retained terminal and contrast coverage. Hosted shared CPU caused initial interaction tests to exceed the original 5s timeout; renderer test setup now allows 20s without reducing assertions.

`npm run build`: exit 0, 22 modules. Existing single xterm/React renderer chunk warning remains (~586kB minified); no build failure. `git diff --check`: clean.

## Browser evidence / screenshots
Command: `node docs/capture-compact-ui.cjs` against the **actual production build** served on owned localhost:5198. Current environment uses the existing playwright-core installation in `/opt/data/projects/game-maze-review/node_modules`; Chromium is `/opt/hermes/tools/chromium-1208/chrome-linux64/chrome`. No game repository files were changed.

All captures use **isolated example data with a substituted bridge**. Native actions and cloud responses are simulated; screenshots have a visible provenance badge. These are browser renderer evidence, not native execution, on-disk app data, authentication or live GitHub cloud verification.

Inspected all five final images using vision tools:
- `/opt/data/output/rifttask/compact-ui/project-dark.png` (1440×960)
- `/opt/data/output/rifttask/compact-ui/project-light.png` (1440×960)
- `/opt/data/output/rifttask/compact-ui/settings-cloud-dark.png` (1440×960; verified example repository + unchecked consent)
- `/opt/data/output/rifttask/compact-ui/settings-cloud-light.png` (1440×960; default off configuration)
- `/opt/data/output/rifttask/compact-ui/project-light-1024.png` (1024×960 board)

Review: readable dark/light hierarchy, dense grouped sidebar, no clipping or horizontal page overflow at 1440/1024, visible plaintext/history warning and disabled Enable before consent. No marketing hero, decorative stats, tile grid in Settings, gradient background or glass treatment. Tiny split theme swatch is a theme-choice illustration only. Diagnostic compositional slop: 0/10.

Browser assertions and console readback: `/opt/data/output/rifttask/compact-ui/browser-checks.json`. Measured sidebar 220px, category 30px, project 32px; no page overflow in list/board/Settings at 1024; four repeated Settings returns leave one cloud instance, one status read and zero sync calls; light persists after reload; no page errors. Preview server/browser cleaned up; port 5198 verified unreachable afterward.

No real app workspace, credentials, GitHub state or cloud repository accessed. No commit/push performed. Parallel icon-worker/parent changes outside src and screenshot docs are not owned by this UI task.
