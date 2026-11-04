# Windows PTY handshake correction

## Change

- Windows smoke now launches the system Windows PowerShell with `-NoLogo -NoProfile -NonInteractive -EncodedCommand`. Its bounded Console protocol reads only `state`, `resize` and `exit`, avoiding interactive prompts, PSReadLine and echoed PowerShell commands.
- The child constructs short random-nonce frames for TTY/READY/STATE/RESIZE. No complete frame occurs in input commands. Matching accepts cursor-position CSI sequences, CR redraws, callback fragmentation and line wrapping instead of requiring whole newline-delimited marker lines.
- TTY input/output checks, retained state, actual 91×31 Console dimensions, zero exit status, PID disappearance and failure cleanup remain required. The runtime/architecture gate, pinned Electron 45.0.0, shipped Windows prebuild policy and no compiler fallback are unchanged. Unix shell commands remain unchanged.
- Failures include stage, exit observation/code and a bounded escaped tail of this owned smoke shell's output. ESC/C0/C1/bidi controls are escaped; parent environment is not dumped and the shell retains the existing environment allowlist.

## Investigation and RED → GREEN

The reported Windows log reached TTY but timed out at READY. No native Windows trace or execution host was available. Ranked hypotheses were VT redraw/framing mismatch, interactive PowerShell/PSReadLine command processing, then runtime/ConPTY startup problems. The installed node-pty source defaults `conptyInheritCursor` to false, so a cursor-position request was not assumed to be the cause.

A controlled replay against the unchanged `HEAD:scripts/pty-native-smoke.cjs` supplied a clean `RIFT_TTY` line followed by `\rPS> \x1b[8;1HRIFT_READY\x1b[9;1HPS> `. The original smoke actually returned **`PTY runtime smoke timed out waiting for RIFT_READY.`** after its normal timeout. Saved harness and RED output: `/opt/data/cache/scratch/rift-legacy-replay-_74l6sh4/`. This proves a parser failure mode, **not the user's exact native Windows root cause**.

`tests/pty-smoke-protocol.test.cjs` was created before implementation; its initial run was RED because the session seam was absent (`runSession is not a function`). It also explicitly demonstrates the old parser rejecting synthetic READY redraw output. The implemented replay then passed. A separate diagnostics test was RED on unescaped C1 controls (`no executable terminal controls`), then GREEN after escaping them.

Coverage includes synthetic cursor moves, CR redraws, wrapping, character-by-character callback fragmentation, echoed input, wrong nonce, truncated frames, stderr-like error text, early/nonzero exit, unconfirmed exit cleanup and surviving PID. A real controlled Linux Node subprocess additionally exercises protocol input/output and verifies actual PID disappearance. These are protocol tests, **not PowerShell or ConPTY execution**.

## Verification

- `npm ci --ignore-scripts`: 381 packages installed in this isolated worktree; existing audit reports 15 moderate vulnerabilities. No dependency/lockfile change or blanket script approval.
- `npm exec --no -- electron-builder install-app-deps --arch x64`: real Linux node-pty rebuild for Electron 45.0.0 completed.
- `node --test tests/pty-smoke-protocol.test.cjs tests/prepare-native.test.cjs tests/electron-runtime.test.cjs`: **27 passed, zero failed**. Includes the real Linux PTY TTY/input/state/resize/cleanup smoke and its real delayed-cleanup failure test.
- Full final `npm test`: **188 core passed, 6 skipped, zero failed** (194 total); **42 UI passed** across four files. Archive integrations remain opt-in; PowerShell parser is skipped because `pwsh` is absent. Log: `/opt/data/cache/scratch/rift-windows-smoke-full-green.log`.
- `npm run build`, `node --check scripts/pty-native-smoke.cjs`, `git diff --check`: passed. Existing >500 kB bundle warning remains.
- Explicit pinned Electron download succeeded, but actual Electron smoke launch returned **127**, missing **`libgtk-3.so.0`**. No actual Electron-runtime success is claimed on this host.

## Remaining acceptance

Retry the installer on native Windows and retain its new stage/escaped-output diagnostics if it fails. Neither native Windows PowerShell/ConPTY execution nor the user's exact timeout cause is established here. No README, installer packaging policy, workflow, user-data or `.local` changes; no commit or push. Parent owns independent review/publication.
