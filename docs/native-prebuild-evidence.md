# Native prebuild installer correction — 4 November 2026

## Outcome and boundary

Mac/Windows source setup now consumes the pinned `node-pty@1.1.0` N-API prebuilds instead of forcing `electron-rebuild`. Linux retains its native rebuild path. This is implemented and fixture-tested on Linux, **not native Mac/Windows installation acceptance**. No commit, push, merge, release, CI/workflow changes, user-data changes or security bypass were performed.

The README is now 42 lines; detailed setup, development, safety, troubleshooting and exact-commit instructions moved to `docs/SETUP.md`. The exact public curl/irm quick-start commands remain unchanged and tested.

## Root cause and behavior

- `native:rebuild` previously unconditionally invoked `electron-builder install-app-deps`, and packaging enabled automatic rebuilding. This discarded the benefit of already-shipped N-API prebuilds and required Visual Studio on Windows.
- Upstream's node-pty install lifecycle can remove prebuilds when `npm_config_build_from_source=true`, then fall back to node-gyp. Mac/Windows installers now use `npm ci --ignore-scripts`, including when this setting is inherited. No shared npm configuration is changed, and no scripts are blanket-approved.
- `native:prepare` validates exact platform/architecture (x64/arm64), the pinned package version, nonempty native binaries and required helpers. Windows checks both ConPTY addons and `conpty/{conpty.dll,OpenConsole.exe}`; macOS checks `pty.node` and `spawn-helper`. Stale Release/Debug native builds that would override prebuild resolution are rejected.
- Only the pinned Electron 45.0.0 downloader is explicitly run if the runtime is absent or its cache is incomplete. Preflight checks the expected executable path, nonempty executable, and exact `dist/version`; an invalid cache invalidates only Electron's `path.txt` install marker and gets one repair attempt, followed by revalidation (no loop). Downloader target architecture/platform are set locally; inherited skip/override settings cannot substitute a different runtime download. The actual runtime must then report exactly Electron 45.0.0 and pass the platform/architecture check and PTY smoke under `ELECTRON_RUN_AS_NODE=1`.
- Smoke exercises real TTY status, shell input and retained variable state, 91×31 resize, shell exit and PID cleanup in an owned scratch directory. Failure cleanup waits for shell exit. No project shell/profile or user data is used.
- Mac/Windows installer packaging explicitly passes `--config.npmRebuild=false`. Ordinary packaging now uses a **beforePack** hook to validate the prebuild and set `npmRebuild=false` before builder's dependency preparation, retaining production dependency collection. It never returns `false` from beforeBuild (that tells builder node_modules are externally supplied and suppresses collection). Linux restores the original rebuild setting, including across successive targets. Existing asarUnpack and macOS afterPack executable-mode handling remain intact. macOS helper permissions are also repaired before the pre-install smoke.
- `native:rebuild` remains a compatibility alias for platform-aware `native:prepare`, not a blanket no-op.

## Observed RED → GREEN

1. `node --test tests/prepare-native.test.cjs`: initial prebuild-only test RED (`prepare-native.cjs` missing), then GREEN. Added exact-arch/artifact/version/stale-build rejection tests RED (`Missing expected rejection: missing`), then GREEN. Runtime incompatibility asserts no compiler fallback.
2. Linux/native downloader slice RED (Linux rejected as unsupported prebuild; Electron runtime could not be provisioned), then GREEN after retaining Linux rebuild and adding scoped pinned Electron provisioning.
3. Real host smoke RED (smoke implementation missing), then RED on shell prompt/output framing, then GREEN after explicit newline-delimited output markers. This is actual Linux node-pty execution, **not Electron execution**.
4. `node --test --test-name-pattern='script-free|failed native preparation|consumes prebuilds|selectively skips' tests/install-scripts.test.cjs tests/pty-packaging.test.cjs`: **4 failures** before installer/package changes; all GREEN afterward. Old clone/ci/native-prepare/build/package failure fixtures, preservation checks and hostile-path tests remain enabled.
5. Downloader inherited override regression RED (`ia32 !== x64`), then GREEN with explicit per-subprocess target settings. Shared environment remains unchanged.
6. Stale Debug regression RED (`Missing expected rejection: stale-debug`), then GREEN after checking both upstream native build search locations.
7. Cleanup regression: corrected real-shell/injected-input-failure harness RED (exit was not observed before failure returned), then GREEN after bounded exit wait. An initial harness tried overriding a getter-only node-pty event and was corrected to a forwarding wrapper; final test actually delays the real shell exit callback and verifies the PID is gone.
8. `node --test --test-name-pattern='README is a short' tests/install-scripts.test.cjs`: RED on the 70-line maximum, GREEN after README shortening and guide relocation. Guide assertions now follow `docs/SETUP.md`, rather than requiring README bloat.

## Independent review correction: real archive regression

The pinned app-builder-lib contract was checked directly: `packager.js` marks `beforeBuild=false` as external node_modules handling, and `platformPackager.js` then skips its production collector. A clean source-copy integration test reproduced the reviewer's omission with the actual Windows packager, real Electron distribution and real `app.asar`: **node-pty absent, zero dependency entries**. This was not a mocked builder or config-only assertion.

Commands and saved tool-output logs (under `/opt/data/cache/scratch/`):

```sh
# RED before changing the production hook:
RIFT_TEST_ARCHIVES=1 node --test --test-name-pattern='real win32-x64' tests/pty-archive.integration.test.cjs
# GREEN after replacing beforeBuild with beforePack:
RIFT_TEST_ARCHIVES=1 node --test tests/pty-archive.integration.test.cjs
# Runtime RED, then GREEN after cache/version guards:
node --test tests/electron-runtime.test.cjs
```

- `rifttask-archive-red.log`: 1 failed; `node-pty absent from real app.asar (0 dependency entries)`.
- `rifttask-archive-green.log`: **5 passed, 0 failed**. Real Windows x64/arm64 archives each contain **512 dependency entries**; macOS x64/arm64 each **493**. Every archive contains node-pty and node-addon-api. Exact-target addons and all ConPTY DLL/EXE or macOS spawn-helper assets exist nonempty outside asar, with executable macOS helpers. No rebuild occurs on these four targets. Actual target Electron distributions were downloaded; no substitute runtime or hook context was used.
- Linux x64 archive contains **500 dependency entries**, node-pty/node-addon-api and rebuilt `build/Release/pty.node`; test asserts actual `@electron/rebuild` execution. A harness initially expected a Linux spawn-helper too; corrected after checking binding.gyp, which builds that helper only on macOS. No Mac/Windows artifact assertion was removed.
- Integration setup uses a new owned source copy with locked `npm ci --ignore-scripts`; the repository's Linux native build remains untouched. The only target overrides are temporary output locations and disabled signing/executable-resource editing; **no npmRebuild override**. These are cross-packaged unsigned directory artifacts, not native Windows/macOS execution, signed installers or GUI acceptance.
- `rifttask-runtime-red.log`: **5 failed**: partial runtime wasn't repaired, old/missing dist/version skipped installer, failed repair didn't reject, and a process claiming Electron 44.0.0 passed smoke. The latter is a test process with injected version metadata, not evidence of actual Electron 44 execution.
- `rifttask-focused-green.log`: **49 passed, 1 skipped**, including all five runtime regressions, preparation, installer safety and packaging-hook checks. Downloader subprocess fixtures now write the real expected executable name and dist/version marker.
- The integration test also caught and corrected an initial hook-context mistake (`packager.info.appDir`, not `packager.appDir`) before final GREEN.

## Final verification (after review correction)

Executed after final implementation:

```sh
node --test tests/electron-runtime.test.cjs tests/prepare-native.test.cjs tests/install-scripts.test.cjs tests/pty-packaging.test.cjs
RIFT_TEST_ARCHIVES=1 node --test tests/pty-archive.integration.test.cjs
npm test
npm run build
node --check scripts/prepare-native.cjs
node --check scripts/pty-native-smoke.cjs
node --check desktop/pty-before-pack.cjs
bash -n scripts/install.sh
git diff --check
```

- Focused suite: **49 passed, 1 skipped, 0 failed** (50 total).
- Full core suite: **175 passed, 6 skipped, 0 failed** (181 total); five network/build-heavy archive cases are opt-in and separately ran **5/5 GREEN** above.
- UI: **42 passed**, four files.
- Production build, module syntax, Bash syntax and whitespace checks: **PASS**. Existing >500 kB bundle warning remains.
- The remaining skip is the PowerShell parser: `pwsh` is not installed. Windows tests here are source contracts, foreign-platform preparation subprocess fixtures and actual cross-packaging archive checks, not PowerShell/native execution.
- `rifttask-full-green.log` and `rifttask-build-green.log` contain full regression/build output. `rifttask-electron-smoke.log` reconfirms actual Electron launch is blocked with exit **127**, missing **libgtk-3.so.0**; no Electron PTY runtime acceptance is claimed.

## Additional real execution

In a new owned scratch copy, with no reused node_modules:

```sh
npm_config_build_from_source=true npm ci --ignore-scripts --no-audit --no-fund
npm run build
# Call validatePrebuild for win32/darwin × x64/arm64 against actual installed package assets.
npm run native:prepare
npx --no-install electron-builder --linux --x64 --dir --publish never --config.npmRebuild=false
```

- Script-free clean install: **381 packages added**, renderer production build passed. Actual tarball assets passed all four Windows/macOS architecture checks despite inherited build_from_source. npm emitted its existing config/deprecation warnings.
- Native preparation explicitly installed Electron, then **successfully rebuilt node-pty for Electron 45.0.0 on Linux**. Its actual Electron smoke stopped with exit 127: this host lacks `libgtk-3.so.0`. Preparation correctly returned failure instead of claiming compatibility.
- Direct actual Electron smoke on the repository install was likewise blocked by missing GTK. No fake Electron success is reported.
- Real Linux unpacked packaging completed successfully, with builder output confirming `npmRebuild is set to false` for the explicit CLI override. The resulting `app.asar.unpacked/node_modules/node-pty/build/Release/pty.node` existed (67,488 bytes), and macOS prebuilt helpers remained outside asar. This Linux artifact is not a Windows/macOS packaging or launch test.

## Remaining gates

Run the unchanged one-command source installer on native Mac and Windows, both target architectures as available, and verify install + packaged app terminal/sign-in. The installer now fails before copying if its Electron PTY smoke cannot run. This Linux host cannot establish Mac/Windows native behavior, signing/notarization, Gatekeeper/PowerShell policy acceptance, or successful packaged GUI launch. The implementation has no appearance changes; no new screenshot is required.

Parent owns independent review/publication. Until published to public main, quick-start downloads still fetch the old remotely available revision.
