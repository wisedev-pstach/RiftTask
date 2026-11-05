# Startup screen evidence

## Scope
New `src/StartupScreen.jsx` / `.css` and integration tests `src/StartupScreen.test.jsx`; `App.jsx` changes only import + initial `!session` rendering. Existing appearance hook, auth, workspace-load timing, cloud, persistence and settings semantics are unchanged. No forced minimum display time, fake progress, network dependency, added font or package.

Design is a minimal status surface: existing graphite/lime/light tokens and packaged `./icon.svg`, a fine animated ring, heading and short live status. Reduced motion leaves the mark static. Failure stops ring motion, announces the error and preserves keyboard-accessible retry. Self-audit: no generic feature tiles, invented metrics, gradients, glass or marketing framing; centered alignment is intentional for this single-purpose transient status.

## TDD / focused verification
- First RED: `npx vitest run src/StartupScreen.test.jsx` — **0 passed / 1 failed**, missing `Opening RiftTask` heading. First GREEN **1 passed**.
- Second RED: **1 passed / 1 failed**, failure still announced `Loading workspace…` instead of `Workspace unavailable`. Second GREEN **2 passed** after error status/motion handling.
- Added regression coverage for saved light/dark before session resolution; immediate signed-in/signed-out transitions (signed-in UI is not held for workspace load); post-session workspace-load failure/retry; relative icon; no fake progress or extra auth/save/cloud calls; keyboard failure retry.
- Final focused command `npx vitest run src/StartupScreen.test.jsx src/App.test.jsx src/appearance.test.jsx src/Settings.test.jsx`: **48 passed across 4 files**, including **7 startup tests**.
- Isolated production build: `node node_modules/vite/bin/vite.js build --outDir /opt/data/cache/scratch/rifttask-startup-preview-build` passed. Existing >500 kB chunk warning; external output-directory warning is expected. Shared `dist/` untouched.
- `git diff --check` passed. No commit/push. Full combined suite left to parent worker.

## Real Chromium browser checks
`node docs/capture-startup-ui.cjs` serves the isolated build at owned port **5201**, injects a deferred **synthetic** session (no app/user data), and closes its browser/server afterward. Port closure verified.

Verified both themes: packaged relative logo loads; CSS animation is `startup-orbit` under normal motion; browser `prefers-reduced-motion: reduce` changes it to `none` with **zero running animations**; no horizontal overflow at 360px; no page errors or remote requests; no load/login/save/cloud calls while session pending. Dark failure stops motion, retry restarts it, and resolved unauthenticated session immediately leaves startup for sign-in. All three PNGs visually inspected.

Screenshots (fresh current built renderer, 1440×960, provenance visible):
- `/opt/data/output/rifttask/startup/startup-dark.png`
- `/opt/data/output/rifttask/startup/startup-light.png`
- `/opt/data/output/rifttask/startup/startup-error-dark.png`
- Machine evidence: `/opt/data/output/rifttask/startup/browser-checks.json`

These are **browser previews with simulated delayed session**, not verified native Electron launch, real GitHub authentication, disk persistence or cloud sync. Native startup timing/platform behavior remains unverified.
