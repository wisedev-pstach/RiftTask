# Terminal disconnect follow-up — 28 October 2026

## Bounded fix
The previous PTY review recorded a stale renderer Running label after a backend read rejection. Root cause: `Surface.poll` only called the error callback, leaving the retained session's last successful `running:true` snapshot and polling/input surface active. Main-process teardown was already enforced; this was misleading renderer state and repeated rejected requests, not a shell-resurrection defect.

A read failure now marks only the matching retained nonce unavailable, immediately blocks new input/polls, and unmounts/disposes xterm and its timer/observer/input listener. The status says **Shell connection unavailable · close to retry**, not that the OS process exited. Transient read failures also require explicit Close shell and Start native shell; there is no automatic retry/spawn or new main-process behavior. Close already clears stale local state even if the native session has vanished. Previously dispatched input/resize requests cannot be recalled.

## Strict RED / GREEN
- `npm run test:ui -- src/TerminalDock.test.jsx -t 'stops claiming'`: observed **1 failed / 4 skipped**, unable to find the unavailable text; DOM still displayed Running alongside the error. Test was added before production changes.
- Implemented one bounded behavior change in `src/TerminalDock.jsx`.
- `npm run test:ui -- src/TerminalDock.test.jsx`: **5/5 PASS**. New test verifies unavailable text/error, absent Running label, no subsequent reads/input, and explicit recovery control after native Close rejects.
- Independent read-only security/lifecycle review approved with no blockers; separately reran **5/5** and `git diff --check`. Inspected nonce/project guards, dead-surface callbacks, cleanup and account-keyed dock isolation. No external writes by reviewer.
- Parent `npm test`: **113 core/integration + 39 renderer PASS**, no failures/skips.
- Parent `npm run build`: PASS; known xterm entry chunk warning remains (>500 kB; 581.66 kB minified / 160.74 kB gzip).
- `git diff --check`: PASS.

## Real scratch PTY / current screenshot
`node /opt/data/cache/scratch/pty-disconnect-smoke.cjs` ran local Chromium with real xterm, production service/store and node-pty, a synthetic account and newly created scratch shell directory. Uses a Playwright-substituted bridge, **NOT Electron IPC**; static HTTP server is scoped to the script and closed in finally.

Actual execution returned:

```json
{"ok":true,"realScratchPty":true,"removedDirectoryInvalidation":true,"unavailableState":true,"noRepeatedReads":true,"inputSurfaceRemoved":true,"explicitRecovery":true,"pageErrors":[],"notElectron":true,"screenshot":"/opt/data/projects/RiftTask/artifacts/screenshots/pty-disconnect-20261028/connection-unavailable.png"}
```

The harness explicitly started a real scratch shell and executed only synthetic printf, removed its empty saved cwd to trigger production scope invalidation, observed the unavailable state and no reads over a further 1.2 seconds, verified native rejection, closed stale state, recreated the scratch directory, explicitly started again and closed the replacement shell. Finally disposed service, closed Chromium/server and removed scratch account data. No user tasks, project scripts, cloud destination or credentials accessed.

Current 1440×960 screenshot captured and visually inspected: visible top banner labels BROWSER HARNESS / EXAMPLE DATA / REAL SCRATCH PTY / SUBSTITUTED BRIDGE, NOT ELECTRON / NO CLOUD TRANSFER. Bottom dock shows connection-unavailable text, actionable Close shell and actual sanitized missing-directory error; no Running label or fabricated transcript. Empty project UI/tabs remain intact.

## Remaining gates and end of pass
Actual Electron execution remains blocked by host missing GTK. Windows/macOS/ConPTY/installers/signing and authorized real remote cloud transfer remain unverified. No release, main merge, auth/workflow changes or datarepo access. Only reviewed private feature-branch/draft PR delivery is permitted. Today's schedule is unchanged and ends 28 October Warsaw; no overnight continuation, new recurring job or owned preview service.
