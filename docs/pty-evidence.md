# Embedded retained PTY — 28 October 2026

## Delivered and scope

A real explicit-start bottom terminal dock: `node-pty@1.1.0`, `@xterm/xterm@6.0.0`, `@xterm/addon-fit@0.11.0`. The old external launcher is no longer the renderer terminal action (legacy bridge remains for compatibility). No project scripts, shell, Git command or provider task fetch runs when merely opening a project. The warning precedes **Start native shell**: this is a full OS-user shell, not a sandbox; credentials on disk remain accessible even though application environment credentials are not inherited.

The service resolves **only project IDs in the persisted active account workspace**. No renderer account, executable, arguments or directory parameters are accepted for start. Once explicitly started, interactive input is necessarily shell input. Trusted IPC retains exact webContents/mainFrame/local-file URL and arity checks. Every input/read/resize/close also requires the random current session nonce. Session contents are memory-only, never workspace/cloud/backup fields.

Sessions survive feature/project/overview navigation, including a start completing after project navigation. Closing the shell explicitly removes it. Logout invalidates before awaiting auth; new starts during pending disconnect are blocked. Detected account changes, project removal/archive/path changes, unavailable/replaced directories, window close, renderer crash and app quit invalidate/kill owned PTYs. Native callbacks and async scope checks are epoch/identity guarded. Save/import audits are immediate; every PTY operation rechecks persisted project/path and real directory identity. Idle retained sessions get a non-overlapping five-second scope/account audit. External CLI account switching is detected on the next auth verification (five-second audit plus existing bounded gh request latency); it is not instantaneous OS credential monitoring. The active app identity is authoritative between checks, preserving existing disclosed offline identity semantics.

### Bounds

- At most four retained sessions (exited sessions must be closed before replacing).
- At most 16 concurrent main-process asynchronous scope checks.
- Per session: most recent 65,536 UTF-16 output code units; output exceeding 1 MiB in a one-second window kills that session.
- Input: at most 4,096 UTF-8 bytes per IPC input, 65,536 bytes per one-second window; renderer additionally refuses oversized paste and caps pending inputs at 16.
- Resize: integral 2–300 columns, 2–100 rows. xterm scrollback 1,000 lines.
- One non-overlapping renderer read per 500 ms for the visible terminal only. Hidden projects keep shells/output in main, not unbounded mounted terminal instances.
- POSIX: fixed `/bin/bash --noprofile --norc`. Windows: fixed system PowerShell `-NoLogo -NoProfile`. Constructed environment allowlist: fixed PATH/TERM/LANG plus HOME/USER/LOGNAME or Windows system/profile paths. No inherited tokens, SSH agent socket, NODE_OPTIONS, loader variables, shell functions, startup hooks or app-specific environment.

## Strict vertical RED → GREEN evidence

Each row was implemented after observing that row's failure, not a batch of tests written after implementation. Commands below ran from `/opt/data/projects/RiftTask`. Counts reflect the tests present at that point, not the final suite.

| Slice | Exact command | Observed RED | Observed GREEN |
|---|---|---|---|
| Explicit native session, saved cwd, allowlist env, retention | `node --test tests/pty.test.cjs` | 0 pass / 1 fail: missing `desktop/pty.cjs` | 1 pass |
| Token-scoped bounded input/resize/read/close | `node --test tests/pty.test.cjs` | 1 pass / 1 fail: `m.input is not a function` | 2 pass |
| Scope changes/disposal cancel pending starts and late callbacks | `node --test tests/pty.test.cjs` | 2 pass / 1 fail: missing expected rejection | 3 pass |
| Session count/input rate/output flood limits | `node --test tests/pty.test.cjs` | 3 pass / 1 fail: fifth session was accepted | 4 pass |
| Persisted account/project service and save/logout/switch/window cleanup entry | `node --test tests/pty-service.test.cjs` | 0 pass / 1 fail: `service.ptyStart is not a function` | 1 pass; combined manager/service 5 pass |
| Narrow sandbox preload API | `node --test tests/ipc.test.cjs` | 8 pass / 1 fail: missing five PTY methods | 9 pass |
| Trusted-frame/exact-arity PTY IPC dispatch | `node --test tests/pty-ipc.test.cjs` | 0 pass / 1 fail: handlers undefined | `node --test tests/pty-ipc.test.cjs tests/ipc.test.cjs`: 10 pass |
| Main window/app lifecycle invokes PTY teardown | `node --test tests/ipc.test.cjs` | 8 pass / 1 fail: close count 0 instead of 1 | 9 pass |
| Real dock, warning, explicit start, feature/project retention, explicit close | `npm run test:ui -- src/TerminalDock.test.jsx` | 0 pass / 1 fail: no Project terminal region | 1 pass |
| Honest unavailable browser dock and sticky bottom layout | `npm run test:ui -- src/TerminalDock.test.jsx` | 1 pass / 1 fail: missing `.terminal-dock` CSS | 2 pass |
| Remove obsolete external action/unimplemented claim | `npm run test:ui -- src/App.test.jsx` | obsolete external button remained; two old global region queries also exposed the new terminal region | `npm run test:ui`: 36 pass after updating board-only queries and obsolete external-launch expectation |
| Native rebuild/asar unpack contract | `node --test tests/pty-packaging.test.cjs` | 0 pass / 1 fail: npmRebuild undefined | 1 pass |
| mac helper executable permissions before signing | `node --test tests/pty-packaging.test.cjs` | 1 pass / 1 fail: missing packaging hook | 2 pass |
| Block start during asynchronous logout | `node --test tests/pty-service.test.cjs` | 1 pass / 1 fail: new shell accepted while disconnect pending | 2 pass |
| Late explicit-start result retained without wrong-project UI | `npm run test:ui -- src/TerminalDock.test.jsx` | 2 pass / 1 fail: Close shell absent on return | 3 pass |
| Directory disappearance invalidates shell before input | `node --test tests/pty.test.cjs` | 4 pass / 1 fail: input accepted after directory removal | 5 pass |
| Incremental xterm rendering and correct keyboard/resize token | `npm run test:ui -- src/TerminalDock.test.jsx` | 3 pass / 1 fail: wrote `promptnext` instead of incremental `next` and reset active terminal | 4 pass |
| Bounded concurrent scope work | `node --test tests/pty.test.cjs` | Initial unbounded test timed out at 180 s; corrected to bounded 20 ms observation, then 5 pass / 1 fail: overflow not rejected | 6 pass |

The CSS test initially used Vite inline CSS, which vitest returned empty; corrected it to read the real stylesheet and re-observed the expected missing-selector RED before implementation. A full-suite regression exposed a VM fixture without global setInterval; switched to explicit `node:timers` imports. Unit tests mock xterm's canvas adapter because jsdom has no canvas. Real xterm and PTY were separately exercised together below.

## Dependency/native verification — real execution, not a stub

Safe install: `npm install --ignore-scripts --save-exact node-pty @xterm/xterm @xterm/addon-fit` added four packages, audit zero vulnerabilities. Reviewed node-pty's actual `scripts/prebuild.js` and `scripts/post-install.js` before enabling its scripts. npm 12 initially reported scripts blocked despite a successful `npm rebuild` status; **that was not native acceptance**. First smoke failed to load missing `pty.node`. Then:

```
npm install-scripts approve node-pty
npm rebuild node-pty --foreground-scripts
```

Only pinned `node-pty@1.1.0` was approved in package.json. node-gyp 12.4.0 compiled `build/Release/pty.node` using Node v26.12.1 headers, Python and make/g++; postinstall cleaned module build output. No blanket dependency-script approval. Native binary independently checked as ELF64 x86-64. `npm install --package-lock-only --ignore-scripts` also returned zero vulnerabilities.

Scratch-only script `/opt/data/cache/scratch/pty-native-smoke.cjs` runs the **production PTY manager with the real module**, two synthetic projects resolving only a newly created scratch directory. It executes only synthetic printf/test/stty/variable input, never any user project. Checks actual TTY stdin/stdout, synthetic credential environment absence, state retained after second project starts, input, terminal size, explicit close and dispose with shell PID ESRCH afterward. Scratch fixture is removed.

Exact command:

```
node /opt/data/cache/scratch/pty-native-smoke.cjs
```

Observed output (also re-run after final build/rebuild):

```
{"ok":true,"node":"v26.12.1","platform":"linux","arch":"x64","module":"1.1.0","realTTY":true,"cleanEnvironment":true,"input":true,"retainedState":true,"resize":"31 103","cleanup":true,"scratchOnly":true}
```

## Native packaging

`npm run native:rebuild` invoked electron-builder install-app-deps; @electron/rebuild reported preparing and finishing node-pty for Electron 45.0.0/x64. Packaging explicitly has npmRebuild=true and unpacks all node-pty native modules/helpers/ConPTY assets outside asar. A before-signing afterPack hook corrects mac spawn-helper permissions (npm tarball prebuilt helpers were actually observed mode 0644); fixture test verifies mode 0755. No signing/install success claim.

Actual Linux directory package built twice, last against final production renderer:

```
./node_modules/.bin/electron-builder --dir --linux --publish never --config.directories.output=/opt/data/cache/scratch/rifttask-pty-package
```

Exit 0; native dependency rebuild and Linux x64 package succeeded. Package contains `resources/app.asar` and unpacked node-pty `build/Release/pty.node`. Actual package size observed 304,346,418 bytes during inspection. Tested the **packaged unpacked native module**, not just its presence:

```
PTY_SMOKE_NATIVE_MODULE=/opt/data/cache/scratch/rifttask-pty-package/linux-unpacked/resources/app.asar.unpacked/node_modules/node-pty node /opt/data/cache/scratch/pty-native-smoke.cjs
```

Returned the same all-true native result, including retained state, 31×103 resize and PID cleanup.

**Electron process execution remains blocked on this host**:

```
ELECTRON_RUN_AS_NODE=1 ./node_modules/electron/dist/electron /opt/data/cache/scratch/pty-native-smoke.cjs
```

Exit 127: `libgtk-3.so.0: cannot open shared object file`. Thus Linux package construction and the unpacked native module are verified, but actual Electron runtime/IPC/native-window execution is not. Windows/macOS binaries, ConPTY, universal/arch-specific builds, mac signing/notarization/helper execution and installer operation are **unverified** and require platform testing. Windows assumes standard `C:\Windows` system installation. Development after a fresh install may need `npm run native:rebuild`; compiler/platform SDK prerequisites may be required.

## Real renderer/native integration harness

`node /opt/data/cache/scratch/pty-browser-native-smoke.cjs` uses local Chromium, **real xterm**, production service + real account store + node-pty, with a Playwright-exposed local function instead of Electron IPC. Synthetic account only; workspace and shell cwd newly created under scratch and removed afterward. Keyboard typing in xterm executed a synthetic printf; a shell variable survived feature navigation and A→B→A project navigation; Close shell invalidated its session. No page errors. This proves the renderer/service/PTY interaction but **not Electron trusted-IPC runtime**.

Observed final output:

```
{"ok":true,"realXterm":true,"realNodePty":true,"realScratchStore":true,"interactiveKeyboard":true,"featureProjectRetention":true,"explicitClose":true,"pageErrors":[],"notElectron":true}
```

## CURRENT screenshot and preview cleanup

`node /opt/data/cache/scratch/pty-browser-smoke.cjs` loaded the final production renderer in local Chromium with explicit synthetic browser/session-only fixture. Browser preview has no PTY methods and cannot start a shell; test asserted Start native shell disabled. Screenshot visibly says Browser preview, Example and Native terminal unavailable; no fake terminal transcript.

- `/opt/data/cache/scratch/pty-browser-example-native-unavailable.png` — 1440×960, final renderer, visually inspected.
- Terminal dock measured x=284,y=790,width=1116,height=170; bottom exactly 960. Three-column task board and project tabs remain visible. Zero page errors.
- Scratch Playwright tool dependency and all harness scripts/artifacts remain under `/opt/data/cache/scratch/` only. Browser fixture is not app/user task data.
- Vite preview launch was lifecycle-guard blocked, so used an owned scratch Python static server on loopback 5199. It was stopped via its exact owned process handle; port/process readback checked separately. Unrelated preview on 5203 was not changed.

## Final checks and limitations

- `npm test`: **112 core/integration + 38 React tests passed**, no failures/skips.
- `npm run build`: passed; Vite warns that the xterm-inclusive entry chunk is >500 kB (581.46 kB minified, 160.69 kB gzip). This is a warning, not a failed build.
- `git diff --check` and changed desktop module `node --check` checks run separately.
- Memory retention is bounded recent raw terminal output, not a durable transcript or serialized terminal screen. On buffer rollover/project-view remount it replays the bounded tail; full-screen TUI history/state reconstruction is not guaranteed. Live shell process/variables/cwd remain retained. No app-restart session recovery.
- Output caps close flooding shells; they are not OS CPU/process/network quotas. A full user shell can intentionally start detached programs; this is not a process containment/sandbox system. Verified cleanup concerns owned PTY shells, not a promise to terminate arbitrary deliberately detached OS processes.
- No live cloud/backend transfer, user project execution, credential/auth changes or workflows. Worker made no commits/pushes; parent handles reviewed private draft delivery.

## Parent independent review and final verification
- Initial independent review reproduced one real blocker: a reset/dispose microtask after scope validation could allow pending start to spawn after teardown. Parent wrote `teardown after scope validation cancels start before shell creation`; `node --test tests/pty.test.cjs` observed RED **6 pass / 1 fail**, missing expected rejection. Added start epoch capture and immediate post-await closed/epoch check; rerun GREEN **7 pass**. Final independent re-review approved with no concrete blockers and reran 12 focused tests.
- Parent `npm test`: **113 core/integration + 38 React PASS**, no failures/skips. `npm run build` PASS with known >500 kB xterm chunk warning; `git diff --check` PASS. Real native scratch PTY smoke rerun PASS, including retained state, resize, clean environment and shell PID cleanup.
- Known non-blocking issue: if backend invalidates a session, renderer read failure can leave a stale running label until Close shell; Close clears it. Already-in-flight input/resize is not strict-cancelled at every Promise boundary but cannot recreate a torn-down shell or target a replacement nonce.
- Parent inspected current screenshot and copied it to ignored durable `artifacts/screenshots/pty-20261028/browser-preview.png`. This is an honest browser-only/example/native-unavailable image, not native Electron or a fake executed terminal.
- Windows/macOS and actual Electron runtime remain acceptance gates. No release/installer/main merge or real cloud-transfer claims.
