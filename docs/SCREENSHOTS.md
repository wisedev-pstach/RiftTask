# Progress screenshots

User requires real screenshots with every RiftTask development update. Never illustrate unimplemented work as delivered.

1. Read current git SHA/status. Launch a temporary Vite renderer server with a unique strict port. This is a preview, not a native Electron runtime test.
2. Use a named browser session and navigate explicitly to this app. Shared browser helpers can still resolve another active tab between calls; check URL and bring the RiftTask page to front before interacting/capturing. Never operate on another app's controls.
3. Create clearly illustrative project/tasks through the real UI or an explicitly marked preview fixture. Do not upload actual user task data. Browser preview is session-only and does not prove disk/cloud persistence or terminal behavior.
4. Capture with CDP Page.captureScreenshot (format png, fromSurface true, captureBeyondViewport false) after Page.bringToFront. Decode to ignored artifacts/screenshots/<commit-or-feature>/ unique names. If compositor readback times out, retry with fromSurface false after bring-to-front. Inspect screenshot pixels; do not return a blank page or wrong application's capture.
5. Attach actual files using MEDIA:/absolute/path. Describe example data/browser preview and limitations. Screenshots of unchanged UI may accompany backend updates, but say visual layout is unchanged rather than imply a new feature is visible.
6. Stop the temporary server; check the exact owned process/group before killing it. Tool kill may report incomplete; confirm the preview port is no longer reachable. Do not stop unrelated services or browser jobs.

Latest current screenshot: `artifacts/screenshots/three-status-20261026/board-preview.png`, captured from the 2026-10-26 three-status working tree. Actual browser renderer, session-only example project/tasks; exactly Backlog / In progress / Done with one example task in each. Project header still has interim buttons; milestone view/feature tabs/embedded terminal and cloud are not implemented. The optional second editor capture aborted on URL mismatch (shared helper tab drift), without touching the wrong app.

Historical screenshots from commit 580265c: artifacts/screenshots/latest-580265c/project-list.png, project-board.png, task-editor.png. They show four statuses and must NOT illustrate the corrected three-status implementation.
