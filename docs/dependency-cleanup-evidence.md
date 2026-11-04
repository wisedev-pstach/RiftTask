# Deprecated build-dependency cleanup

## Resolution and scope

- Scoped `app-builder-lib` overrides: `@electron/asar` 4.3.1, `@electron/get` 5.1.0, `@electron/universal` 3.0.6. These require Node >=22.12; the existing documented Node 24.15+ (24.x) / 26+ baseline remains sufficient.
- Project `.npmrc` sets `omit=peer` to leave the unused Squirrel.Windows backend out of installs; RiftTask config uses NSIS. `dmg-builder` remains electron-builder's ordinary dependency, and required testing peer `@testing-library/dom` is now explicit. Optional dependencies are not broadly omitted. Squirrel/glob 7/rimraf 2/inflight records remain in the lockfile's peer resolution graph but are absent from the installed tree. The boolean/global-agent chain is removed from the lockfile.
- No glob/rimraf API-breaking blanket overrides, warning suppression, forced audit fix, README expansion or installer behavior changes.
- npm initially retained nested `app-builder-lib/node_modules/@electron/get` 3.1.0 despite the override. Removing that stale entry in a scratch lock copy and having npm regenerate resolution eliminated it; Targeted resolution confirms builder and Electron share get 5.1.0 without invalid-version errors. The complete `npm ls --all --omit=peer` check is not clean: it exits with ELSPROBLEMS for the intentionally omitted electron-builder-squirrel-windows peer. Two stale extraneous lock records remain beneath the former nested get path; fresh installation and all five archive cases still pass.

## Executed verification (Linux x64, Node v26.12.1, npm 12.0.2)

- RED: ran `tests/build-dependencies.test.cjs` against isolated committed HEAD package/lock files. The fresh install succeeded but the assertion failed on all four actual warnings: inflight 1.0.6, rimraf 2.6.3, glob 7.2.3, boolean 3.2.0. Baseline log: `/opt/data/cache/scratch/rift-deps-red.log` (host-local, not shipped).
- GREEN: empty-directory `npm ci --ignore-scripts --no-audit --no-fund --loglevel=warn` printed `added 297 packages in 3s`, with no stderr deprecation warnings. Regression verifies deprecated installed packages are absent, required build/test dependencies remain, Squirrel is absent, and CommonJS consumer imports expose the used asar/get/universal APIs and cache enum.
- Actual repository `npm ci --ignore-scripts --no-fund` also succeeded without the four warnings; audit reports remain visible.
- Final `npm test`: 176 core tests passed, 6 skipped (PowerShell unavailable plus five opt-in archives); 42 UI tests passed. Final host-local output: `/opt/data/cache/scratch/rift-deps-final-tests.log`.
- `RIFT_TEST_ARCHIVES=1 node --test tests/pty-archive.integration.test.cjs`: **5 passed, 0 skipped**. Real electron-builder directory packages verified Windows x64/ARM64, macOS x64/ARM64, Linux x64. Every app.asar retained node-pty and node-addon-api; target PTY binaries/helpers were nonempty and unpacked. Windows includes both conpty addons, conpty.dll and OpenConsole.exe; macOS spawn-helper executable mode verified. Windows/macOS avoided native compilation; Linux retained Electron rebuilding. Archive fixtures now copy `.npmrc` so they reproduce the actual source install policy.
- `npm run build` and `git diff --check` passed. Existing >500 kB Vite bundle warning remains.
- `npm audit --omit=dev --json`: zero vulnerabilities. Full audit: 10 moderate findings in build dependencies (glob/minimatch and dependent chains). Not resolved by this deprecation-only change; npm's proposed force fix downgrades electron-builder to 20.23.1 and was not applied.

## Limits

`npm run native:prepare` downloaded Electron and completed Linux native rebuilding, then Electron runtime smoke exited 127 because `libgtk-3.so.0` is missing. No GUI/native Electron launch is claimed. The core real-host PTY test passed, but it is not an Electron GUI test. Windows/macOS archives are real cross-built packages, not native execution, installer/signing acceptance, or a universal-binary merge test. No commit or push performed.
