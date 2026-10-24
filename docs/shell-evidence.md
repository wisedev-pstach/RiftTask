# Secure Electron shell evidence

## Implemented

- `desktop/main.cjs`: real Electron entry point; single-instance lock; local `dist/index.html` only; no environment URL override; sandboxed/context-isolated BrowserWindow with Node integration/webviews disabled and web security enabled. All page/frame navigation and redirects are prevented; new windows and permission requests/checks are denied. App activation restores/recreates the window; IPC handlers are removed on close/quit.
- Main constructs `createAuth({cachePath: userData/identity.json})`, `createStore(userData)`, then `createService({auth,store})`. No cloud backend or renderer-held credentials.
- `desktop/ipc.cjs`: per-method channels; strict sender WebContents, exact main-frame identity, and exact local index-file URL checks before dispatch. Remote frames, subframes, other windows, missing frames, and index URL query/fragment variants are rejected. Basic session/login/logout/load/save delegate to the main-only service, with fixed argument counts.
- `desktop/preload.cjs`: sandbox-compatible self-contained preload exposing a frozen, explicit Promise-returning `window.rift`; no raw Electron object, token, generic channel invocation, or Node API.
- `openRepository` accepts canonical credential-free HTTPS GitHub repository URLs and Azure DevOps repository URLs (including legacy organization.visualstudio.com). Rejects arbitrary hosts, protocols, credentials, non-default ports, query/fragment, URL normalization tricks, percent escapes and path traversal. A deliberately conservative path-segment whitelist rejects URLs containing encoded spaces.
- `openTerminal`, `gitStatus`, `chooseDirectory`, `exportBackup`, and `importBackup` reject with a clear not-yet-available message. They are not simulated or advertised as working native integrations.

## Actual verification

Commands run in `/opt/data/projects/RiftTask`:

1. `node --test tests/ipc.test.cjs` initially failed because IPC module was absent (RED), then passed the first trusted-sender/dispatch slice (GREEN).
2. Added URL policy + deferred integrations tests: 1 pass / 2 failures for missing handlers (RED); implemented handlers, reran: 3 pass / 0 fail.
3. Added preload VM test: 3 pass / 1 failure for missing preload (RED); implemented preload, reran: 4 pass / 0 fail.
4. Added Electron lifecycle/security tests using injected fake Electron: 4 pass / 2 failures for missing main module (RED); implemented real entry point, reran: 6 pass / 0 fail.
5. Added regression coverage for sanitized local-load failure; final `node --test tests/ipc.test.cjs`: **7 tests, 7 pass, 0 fail**. No npm dependencies required for these tests.
6. `node --check desktop/main.cjs`, `node --check desktop/preload.cjs`, and `node --check desktop/ipc.cjs`: all exited successfully.
7. Concurrent full `npm run test:core` snapshot: **23 tests, 22 pass, 1 fail**, in another agent's in-progress auth test `rejected credentials clear offline identity so later network failure cannot resurrect it`. No backend files modified by this shell work. Parent must rerun after backend work completes.
8. `npm run build` attempted while renderer work was still in progress: failed with `Cannot resolve entry module index.html`. Do not treat this as a completed production build. Parent/UI agent must finish renderer and verify Vite uses relative asset URLs (`base: './'`) for file loading.
9. Native Electron binary launch/version attempted: blocked before app startup by missing host library `libgtk-3.so.0`. No Xvfb command or DISPLAY was available. Real graphical startup is **not verified** on this container; fake-Electron/VM checks are not a GUI smoke test.

## Follow-ups / disclosure

- Login currently verifies the user's installed official `gh` credentials via backend auth; it does not launch terminal onboarding yet. Users may need `gh auth login --hostname github.com`, then retry. Do not claim an embedded OAuth flow or a completed native terminal login flow.
- Native terminal, git status, directory dialog, backup/restore, installers and real Windows/macOS startup remain later milestones.
- Before shipping: complete production renderer build, real Electron desktop smoke including preload bridge availability and `file://` asset loading, and final full-suite run. No commits, pushes, external authentication changes, or edits to other agents' owned files performed.
