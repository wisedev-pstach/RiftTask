# Isolated native smoke CLI exit

## Reported observation and investigation boundary

The supplied Windows installer log installed 297 packages, downloaded Electron 45.0.0 win32-x64, and printed:

```text
Electron 45.0.0 PTY verified: {"tty":true,"input":true,"state":true,"resize":true,"cleanup":true}
```

Its parent then reported `spawnSync electron.exe ETIMEDOUT` at the existing 120-second prepare timeout. This is after successful session verification, not the earlier READY handshake failure.

Pinned node-pty 1.1.0's `lib/windowsConoutConnection.js` creates a referenced worker draining the ConPTY output pipe. Its worker termination is separate from shell exit. `lib/windowsPtyAgent.js` separately drains/destroys sockets following process exit. These establish plausible process-retaining resources, **not proof of which native Windows handle remained open**. No native Windows execution or active-handle trace was available here.

The previous CLI merely logged its completed result (or assigned `process.exitCode` after failure). Neither operation terminates an event loop with remaining referenced resources. Ranked explanations were retained worker/socket handles, unfinished smoke shell cleanup, and unfinished temporary-directory cleanup. The reported five checks constrain the latter two; the regression below isolates the first without bypassing session verification.

## Strict RED → GREEN

`tests/pty-smoke-cli.test.cjs` first invoked the actual production CLI in a bounded Node subprocess with the real Linux node-pty module and a test-only referenced interval. A preloader sets `process.versions.electron` only to exercise the CLI runtime gate: **these are Node/Linux PTY tests, not native Electron/Windows acceptance**.

- Before production changes: **1 test failed**, after 4 seconds, with `ETIMEDOUT` despite exact complete verified stdout and an empty smoke temporary directory. This reproduces the parent/child timeout symptom after all five real PTY checks.
- After changing only CLI success completion: **1 passed**, approximately 99 ms.
- Failure regressions were then added for wrong Electron version, missing module and injected temporary-directory removal failure. Before changing the failure completion: **3 failed with ETIMEDOUT, 1 passed**. Each expected diagnostic was present; no success was printed.
- After changing CLI failure completion: all six final subprocess tests passed, including additional surviving-PID failure and imported-library caller-survival guards.

The temporary-directory removal failure emits a 128 KiB diagnostic ending in `:END`; the complete stderr is asserted to ensure output is flushed before exit. Success asserts exact full stdout, no stderr, empty smoke scratch directory and zero status without a parent timeout. Missing module/wrong version/removal failure assert nonzero status without timeout. A real shell session plus injected live-PID observation verifies cleanup cannot become success. The library guard calls exported `smoke()` and observes a subsequent caller timer before clearing its owned interval, proving imported usage is not terminated.

Only the isolated `require.main === module` completion changes: flush final stdout then exit zero only when the write callback reports no error; exit one if that flush fails, or after final stderr on rejection. No process-wide exception handlers are installed. All existing session checks and `finally` cleanup remain untouched. This does not claim the native worker is repaired or the application's retained PTY lifecycle is fixed. No timeout increase, dependency patch, compiler requirement, unrelated process kill or application lifecycle change.

## Reviewed stdout flush failure: strict RED → GREEN

Review found that the success write callback ignored its error argument, so a closed stdout reader could cause `EPIPE` yet still exit zero. Added a bounded real subprocess regression using the same real Linux PTY and retained interval fixture, with the parent destroying the actual stdout reader before completion (no mocked write). It asserts exit one without timeout or signal, empty stderr (no unhandled stream error), and removed smoke scratch directory.

- RED, before the callback change: **1 failed**, actual exit **0**, expected **1**, approximately 96 ms. Log: `/opt/data/cache/scratch/rift-smoke-flush-red.log`.
- GREEN: the callback now exits `error ? 1 : 0`. The real closed-pipe regression passed in approximately 98 ms as part of the focused suite. The callback exits directly, so no extra stream error listener or blanket error swallowing is needed. Imported-library behavior and the stderr failure path remain unchanged.

## Verification

- Targeted: `node --test tests/pty-smoke-cli.test.cjs tests/pty-smoke-protocol.test.cjs tests/prepare-native.test.cjs tests/electron-runtime.test.cjs`: **34 passed, zero failed** (the prior 33 plus the closed-pipe regression). Log: `/opt/data/cache/scratch/rift-smoke-flush-green.log`.
- Full `npm test`: **197 core passed, 7 skipped, zero failed** (204 total); **56 UI passed** across six files. Log: `/opt/data/cache/scratch/rift-smoke-flush-full-test.log`. Archive integrations are opt-in and native PowerShell parsing is skipped where unavailable.
- `npm run build`: passed; existing >500 kB bundle warning remains.
- `node --check` for production CLI and new tests, and `git diff --check`: passed.

Native Windows Electron/ConPTY and installer rerun remain unexecuted acceptance gates. No UI, auth/cloud state, `.local`, dependencies or lockfile changes. No commit or push.
