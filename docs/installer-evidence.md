# Installer verification evidence

## Current rerunnable-update implementation

Mac/Windows now delegate publication to freshly fetched `scripts/install-deploy.cjs`, loaded after dependencies are ready. Fresh build, native verification and packaging precede sibling staging, staged identity validation, exclusive deployment locking, old-app backup and rename promotion. Failed promotion restores the old app; failed rollback prints the retained backup/manual restore paths. Existing backups and application data are never pruned. Linux behavior remains new-install-only.

Test-first failures were observed for legacy replacement, the exact repeated Bash curl and PowerShell irm recipes, unsafe symlinks/overlaps, copy/promotion/rollback and running/locked/raced destinations, empty executables, cleanup diagnostics, and builder-stripped canonical identity. Final automated core result: **247 tests, 241 passed, 6 optional packaging tests skipped, zero failures**, with real PowerShell 7.4.6 on Linux and simulated Windows COM/build tools. UI: **65 passed**. Renderer build and host Linux x64 packaging succeeded. Actual Electron 45 PTY preparation verified TTY/input/state/resize/cleanup after loading missing GTK runtime libraries from owned scratch downloads using `LD_LIBRARY_PATH=/opt/data/cache/scratch/rift-native-libs/root/usr/lib/x86_64-linux-gnu`. No native Mac/Windows installation/launch proof is claimed.

Reproduce core tests:

```sh
PATH=/opt/data/cache/scratch/rifttask-pwsh:$PATH DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1 RIFT_PWSH=/opt/data/cache/scratch/rifttask-pwsh/pwsh npm run test:core
```

### Legacy identity and trusted temp-root corrections

The stripped-legacy compatibility blocker is fixed in the helper and exercised against real ASARs made from historical `30adc55:package.json` passed through the installed electron-builder `createTransformer`. Assertions require both `build` and `rifttask` to be absent from the legacy packaged manifest. New bundles retain `rifttask.appId`.

Recognition always requires ASAR `name=rifttask`, `main=desktop/main.cjs`, and a nonempty regular executable. Any present `build.appId` or `rifttask.appId` contradicting `dev.wisedev.rifttask` rejects, even if the other ID/native metadata matches. For legacy macOS, `Info.plist` must also prove `CFBundleIdentifier=dev.wisedev.rifttask` and `CFBundleExecutable=RiftTask`, and the executable must be executable. For legacy Windows, both static PE `ProductName` and `FileDescription` must equal `RiftTask`. Windows reads only `[Diagnostics.FileVersionInfo]::GetVersionInfo` via noninteractive PowerShell, with a 10-second timeout, 8192-byte output limit, checked exit/JSON, and the executable path passed as environment data. It never launches the existing app. Missing, unreadable, or different PE resources fail closed; no filename/marker-only fallback exists. This is compatibility recognition, not cryptographic publisher authentication.

Only the trusted fresh source root is realpathed before deriving the build bundle through a strict relative-containment check. Trusted temp/source roots are canonicalized for overlap checks; the destination is not canonicalized. A macOS-style trusted root alias therefore works while symlinked `.app`, executable, ASAR, plist, destination and destination ancestors remain rejected. No blanket symlink exemption was added.

Actual vertical RED → GREEN commands used `node --test --test-name-pattern='<pattern>' tests/install-deploy.test.cjs`:

| Pattern | Observed RED | Observed GREEN |
| --- | --- | --- |
| `historical Mac` | 0 pass / 1 fail: stripped legacy ASAR rejected for missing canonical ID | 1 pass: old bytes retained in backup, new app published using bundle identity |
| `historical Windows` | 0 pass / 1 fail: stripped legacy ASAR rejected | 1 pass: explicit static-version inspector seam proves fallback and backup/publication |
| `trusted fresh source` | 0 pass / 1 fail: trusted root alias rejected as symlink | 1 pass: canonical trusted source publishes; destination alias still refused |

Final verification on Linux: **13/13 helper tests passed**; **252 core tests: 246 passed, 6 optional packaging skips, zero failures**, using the PowerShell flags above; **65 UI tests passed**; renderer build and `git diff --check` passed (existing >500 kB bundle warning remains). Core log: `/opt/data/cache/scratch/rifttask-legacy-core.log`. One intermediate negative-test fixture needed ASAR cache invalidation after rewriting the same archive; final tests explicitly uncache those rewritten fixture archives.

**Native acceptance remains open:** Linux tests use sentinel executable bytes and an explicit injected Windows version inspector; they do not prove Windows PE resource reading or published binaries' actual metadata. On Windows, qualify a genuine older packaged executable's `ProductName`/`FileDescription`, the default nonexecuting inspector, reparse-path refusal, rollback and launch. Nonstandard older binaries without both exact version fields are deliberately refused. On macOS qualify actual `/var` → `/private/var` temp paths, bundle copy/signing/Gatekeeper and launch. No native Mac/Windows acceptance, commit/push, app-data access or `.local` deletion is claimed.

### Framework preservation and exclusive-publication corrections

The framework regression first failed with `Versions/Current` rewritten from `A` to an absolute path in the temporary fresh source. `cpSync` now uses `verbatimSymlinks:true`. The real-filesystem test builds a versioned Electron framework with Current/binary/Resources links, deploys it, deletes its own complete source tree, then checks unchanged relative link literals and successful resolution inside the installed app. Identity-path symlink rejection remains intact.

Publication and rollback race regressions were each observed RED before their fix: an empty target created immediately before POSIX `renameSync` was overwritten; rollback incorrectly claimed successful restoration. All three directory moves now use `renameExclusiveSync` (old app → unique backup, stage → target, backup → target). Tests cover empty and populated late arrivals, unchanged unrelated inode/contents, retained previous bytes/backup, no nested app, owned-stage cleanup and lock removal. Additional tests cover fresh-install publication, backup-destination arrivals, destination files/symlinks, directory-only Windows hook contracts, and bounded/fail-closed native bridge behavior. [Provider contracts and authoritative native references](INSTALLER-UPDATES.md#directory-publication-provider-contract) document exact flags, dependencies and scope.

Darwin's fixed JXA script uses `renamex_np(RENAME_EXCL)` with the official `0x00000004` value. Windows uses directory-only Node/libuv `MoveFileExW`, whose documented contract rejects existing destination directories. No production check-then-rename fallback was added. Running-process probes also now have 10-second / 8192-byte / hidden-console bounds. The obsolete SETUP claim that stripped legacy archives are always refused was corrected. A separate RED → GREEN regression covers a native backup move that completes but loses its child-process confirmation: diagnostics now print both the original path and backup candidate instead of falsely claiming that the old app remains at the original path.

**Actual Linux syscall proof:** GNU coreutils 9.7 fixture moves were traced using scratch-extracted `strace` 6.13 and libunwind (no system package/compiler dependency was added). `/opt/data/cache/scratch/rift-rename-trace/syscalls.log` shows `renameat2(..., RENAME_NOREPLACE)` returning 0 for successful moves and `EEXIST` for publication/restore collisions; no ordinary `rename`/`renameat` fallback appeared. GNU's successful-skip status was actually observed and the helper checks source disappearance to reject it. This test-only provider is explicitly opted in via `RIFTTASK_TEST_GNU_MV=1`; unopted-in Linux/other hosts refuse. GNU/gnulib has non-atomic fallbacks on unsupported filesystems/kernels, so no portable Linux-updater guarantee is claimed.

**Final verification:** full core **262 tests: 256 passed, 6 optional packaging skips, 0 failed**, including real PowerShell **7.4.6** parser and simulated Windows installer execution; UI **65 passed in 7 files**; production renderer build, Bash syntax and `git diff --check` passed. Core log: `/opt/data/cache/scratch/rifttask-review-core.log`. The existing >500 kB JS chunk warning remains. Native Mac/Windows hosts were unavailable: JXA/Windows hooks and Linux filesystem/syscall tests are **not** native installation/launch acceptance. Native platform qualification remains open. No commit/push, real app-data access, `.local` deletion or quarantine changes occurred.

The following sections are historical evidence for earlier installer behavior, not current update instructions.

# Simple public quick-start — 4 November 2026

## Current entrypoints

README quick setup now uses `bash -o pipefail -c 'curl -fsSL https://raw.githubusercontent.com/wisedev-pstach/RiftTask/main/scripts/install.sh | bash'` on macOS/Linux and `irm https://raw.githubusercontent.com/wisedev-pstach/RiftTask/main/scripts/install.ps1 | iex` on Windows. These execute trusted downloaded code from moving public `main`; they are not signed/pinned releases. Download/inspect recipes and advanced full-SHA bootstrap/source pins are separate optional sections. No persistent source checkout is required for quick setup.

The existing Bash installer already works from stdin without script-relative resources; no Bash production changes were needed. PowerShell replaces host-terminating `exit` with scoped `return` or terminating `throw`, scopes preferences/helper functions, and uses path-independent help so downloaded evaluation does not need a script filename. File-based `-Check`, `-Dest`, and `-Ref` remain available. Its native exit checks, literal paths, owned-temp cleanup, architecture matching and existing-destination refusal are unchanged. Neither installer requires/installs/invokes `gh`; the app still uses official `gh` unchanged. No app/UI/auth/cloud code changed, no real user-data access or `.local` cleanup occurred, and no policy/security bypass was added.

## Actual test-first RED → GREEN

Targeted command pattern: `node --test --test-name-pattern='<pattern>' tests/install-scripts.test.cjs`.

| Slice | Observed RED before implementation | Observed GREEN |
| --- | --- | --- |
| `README quick curl` | 0 passed / 2 failed: simple documented streaming recipe absent | 2 passed: exact README recipe streams the real installer into Bash with gh absent, simulated macOS ARM64 packaging, owned-temp cleanup and repeat-install refusal; failed curl returns 22 without installer commands/build or HOME/temp effects |
| `PowerShell downloaded` | 0 passed / 1 failed: host-terminating `exit` remained | 1 passed: source contract for scoped preferences, return/throw, filename-independent help and exact Windows README recipe; **not runtime proof** |
| `README separates` | 0 passed / 1 failed: optional inspection section absent | 1 passed: inspection and advanced pins distinct, both platforms retain parameterized pin recipes, obsolete persistent-checkout instruction absent |

The curl executable fixture streams the actual current `scripts/install.sh` file, not a fabricated installer response. Build/npm/packaging remain controlled executable fixtures, not native builds. Existing real-local-Git main-selection and older-commit SHA-pin tests remain separate and passed. A failed empty download is tested; piping downloaded code is not an atomic verified download and cannot promise that no prefix runs after a partially transferred response. Public network reads, if performed by the parent, are separate from fixture execution.

## Real verification on this host

- `node --test tests/install-scripts.test.cjs`: **29 tests; 28 passed, 0 failed, 1 skipped**. Log: `/opt/data/cache/scratch/rifttask-simple-focused.log`.
- `npm test`: exit **0**; **157 core/integration tests: 156 passed, 0 failed, 1 skipped; 42 UI tests passed in 4 files**. Log: `/opt/data/cache/scratch/rifttask-simple-npm-test.log`.
- `npm run build`: exit **0**; Vite **8.3.5**, **21 modules**. Existing >500 kB chunk warning remains (582.34 kB JS). Log: `/opt/data/cache/scratch/rifttask-simple-build.log`.
- `git diff --check`: exit **0**. Bash syntax/help remain covered by the focused suite.

PowerShell is unavailable; parser/runtime and actual Windows IEX behavior were **not** executed. Native macOS/Windows dependency build/install/launch and packaged PTY remain owner acceptance checks. Simulated macOS execution is not native macOS proof. This work is on `fix/simple-install-entrypoints`, with no commit/push/merge/publication; the public-main download URLs do not contain these unpublished changes yet.

---

# Historical public-source installer update — 4 November 2026

The following earlier verification and persistent-checkout README handoff are superseded by the simple-entrypoint update above. Its safety evidence remains relevant.

## Current behavior

The owner made `wisedev-pstach/RiftTask` public (visibility verified by the parent). Both scripts now use normal anonymous HTTPS `git clone --depth=1 --branch main https://github.com/wisedev-pstach/RiftTask.git` into a fresh invocation-owned build tree. They neither discover, require, install nor invoke `gh`, and do not check authentication or add a credential helper. Optional full lowercase 40-character commit pins still fetch, detach, read back and verify HEAD before npm. Shared Git configuration and credentials are untouched.

Official `gh` remains required separately for **app first-use identity and optional private cloud access**. The cloud planning-data target remains a separate initialized, user-owned private personal repository; public source is not a public task-data store. Runtime auth/cloud code and UI were not changed; appearance is unchanged.

Existing-destination refusal, owned-tree-only cleanup, relative-TMPDIR rejection, literal hostile paths, architecture checks, quarantine/policy preservation and immediate native failure handling remain covered. No `.local` or real user-data cleanup was performed. Tests only remove their own scratch fixtures.

## Actual vertical RED → GREEN

Each slice was run RED before changing its corresponding implementation, then GREEN before moving to the next slice:

| Slice / command pattern (`node --test --test-name-pattern='…' tests/install-scripts.test.cjs`) | Observed RED | Observed GREEN |
| --- | --- | --- |
| `public source check` | 0 passed / 1 failed: missing gh aborted prerequisites (exit 1) | 1 passed: both absent gh and a fail-fast gh trap, unavailable auth, no filesystem effects |
| `public isolated source build` | 0 passed / 1 failed: source clone invoked missing gh (exit 127) | 1 passed with real local Git main/feature commits, main marker required, gh absent, no inherited auth; isolated build/install fixture succeeds |
| PowerShell public-source clone/fetch native contracts | 0 passed / 3 failed: gh invocation remained, Git clone/fetch contracts missing | all 7 PowerShell source contracts passed; textual contracts only, not runtime proof |
| `README one-command` | 0 passed / 1 failed: documented command invoked missing gh (exit 127) | 1 passed: exact documented Bash command uses real local Git, captures SHA, installs that exact revision without gh, refuses existing checkout before external commands |

Fixture transport maps only the expected public HTTPS URL to a real local `file://` repository, with isolated Git configuration and file-only protocol. npm/build/packaging are controlled executable fixtures, **not an actual dependency build or native installer acceptance**. Default fixture `gh` is now a fail-fast trap (exit 97) before version/auth handling, so successful complete builds also prove it was never invoked. Existing clone/npm/rebuild/build/package failures, destination preservation, hostile paths, Node/architecture checks and older pinned-commit selection still pass. No network credentials or real application data are used.

## Real verification on this host

- `node --test tests/install-scripts.test.cjs`: **26 tests; 25 passed, 0 failed, 1 skipped** (pwsh absent).
- `npm test`: exit **0**; **154 core/integration tests: 153 passed, 0 failed, 1 skipped; 42 UI passed in 4 files**. Full run log: `/opt/data/cache/scratch/rifttask-public-npm-test.log` (scratch, not a committed artifact).
- Separate `npm run test:ui`: **42 passed in 4 files**, exit **0**.
- `npm run build`: exit **0**, Vite **8.3.5**, **21 modules**; existing >500 kB chunk warning remains (582.34 kB JS output).
- `bash -n scripts/install.sh` and `git diff --check`: exit **0**.

Native macOS/Windows install/launch and packaged PTY remain owner checks. PowerShell is unavailable; its parser test skips honestly. No signed/prebuilt release, external writes, source commit/push/merge, auth changes or real cloud/user-data access were performed by this worker. Parent handles independent review and publication; README public-main commands depend on this update being published there.

---

# Historical source-build bootstrap safety evidence — 3 November 2026

The remainder is historical evidence from the private feature-branch installer. Its gh/auth/feature-branch requirements and old counts are superseded by the public-source update above; the safety regressions and native acceptance limitations remain relevant.


## Delivered slice, not whole-product acceptance

Feature scope is frozen. This pass hardens the existing source-build bootstrap and documents an honest native-test handoff. It does **not** establish a released installer, successful native installation, signed/notarized artifacts, corruption-salvage UX, or whole-product completion.

Both bootstraps always clone `wisedev-pstach/RiftTask` at explicit `feat/cloud-persistence` into an invocation-owned fresh build tree. They no longer build in a user's checkout or silently fetch default `main`. This is a **moving feature ref**, not an immutable commit or verified release pin. The README's initial authenticated clone explicitly selects the same branch; its commands must only be distributed after the parent reviews/publishes this slice there.

All existing final destinations are refused, including empty directories, ordinary files and symlinks/reparse points. Linux also refuses an existing command launcher. No app/data destination is recursively removed, no upgrade is attempted, and no shared Windows shortcuts are written. New destinations are reserved without overwrite before copying. Clone/build failures occur before final destination creation. Copy/interruption failure may leave a **new partial directory**, never an automatically deleted old install. Recursive cleanup is limited to the fresh temporary tree owned by this invocation; PowerShell restores location first. This is not a hostile-concurrent-OS-user security boundary.

Quarantine stripping is removed. No execution-policy, Gatekeeper, sandbox or other security bypass is offered. Linux launchers encode the target with Bash `printf %q`; argument text is forwarded through `"$@"` as data. Architecture flags and unpacked output paths are selected explicitly for x64/ARM64, and a matching expected executable must exist. Native commands fail closed; PowerShell checks `$LASTEXITCODE` immediately in its common `Invoke-Native` adapter for version/auth, clone, npm install/rebuild/build and packaging. No output-short-circuiting `Select-Object -First` can bypass that check.

`--check`/`--dry-run` and `-Check`/`-DryRun` fail on authentication denial rather than announcing readiness. They do not clone/build/create directories, change credentials, or touch application data. They check tools, architecture, conservative Node baseline and destination refusal, **not** full compiler availability, private-repo access, download success or native GUI launch.

## Observed vertical RED → GREEN

Unless otherwise noted, command: `node --test tests/install-scripts.test.cjs`. Each numbered behavior was added and observed RED before its implementation, then rerun GREEN before the next behavior. Intermediate fixture mistakes (missing `cat`, an off-by-one log assertion, exported `OS` colliding with the script's own OS normalization) were corrected before accepting a defect's RED; they are not claimed as product defects.

| Behavior | Actual RED | Actual GREEN |
| --- | --- | --- |
| Unauthenticated Bash check | 1 passed / 1 failed: returned zero and announced ready after failed auth | 2 passed |
| Explicit source feature ref / fresh owned tree | 2 passed / 1 failed: clone omitted `--branch feat/cloud-persistence` | 3 passed |
| Existing destination preservation | 3 passed / 1 failed: old directory replaced and success announced | 4 passed; file/directory/symlink preserved |
| Literal Linux launcher paths | 4 passed / 1 failed: generated shell had unmatched quote at launch | 5 passed; actual fixture executable received literal argument; no injected directories |
| macOS quarantine behavior (simulated OS) | 5 passed / 1 failed: `xattr` invoked | 6 passed; no quarantine command |
| Linux ARM64 packaging/output | 6 passed / 1 failed: no explicit ARM64 builder invocation | 7 passed |
| PowerShell native exit adapter, source-contract test only | targeted 0 passed / 1 failed: adapter missing | targeted 1 passed |
| PowerShell literal destination refusal, source-contract only | targeted 0 / 1: refusal absent | 2 PowerShell contracts passed |
| PowerShell isolated explicit ref and owned cleanup, source-contract only | targeted 0 / 1: feature ref absent | 3 PowerShell contracts passed |
| PowerShell ARM64 output, source-contract only | targeted 0 / 1: architecture discriminator absent | 4 PowerShell contracts passed |
| Missing Linux executable despite zero packaging exit | targeted 0 / 1: stale directory copied and success announced | all 12 then-current tests passed |
| Unsupported Node 20 | targeted 0 / 1: check returned zero for Node 20.19.0 | all 13 then-current tests passed |
| PowerShell preview Node baseline/no shared shortcuts, source-contract only | targeted 0 / 1: baseline absent | 5 PowerShell contracts passed |
| macOS ARM64 wrong-architecture fallback | targeted 0 / 1: x64 output installed on simulated ARM64 | all 15 then-current tests passed |
| PowerShell output pipeline cannot skip native check, source-contract only | targeted 0 / 1: `Select-Object -First` remained | targeted 1 passed |
| Missing `--dest` value | targeted 0 / 1: unbound `$2` rather than actionable error | final fixture suite passed |
| Review blocker: relative `TMPDIR` | targeted 0 passed / 1 failed: `TMPDIR=tmp` returned success after clone/build/install | targeted 1 passed: rejects with absolute-path guidance before mktemp/clone; fixture temp directory contains only unchanged unrelated sentinel, no owned-tree leak or destination |
| Review: macOS printed hostile launch path | targeted 0 passed / 1 failed: stdout included raw hostile path in `open` command | targeted 1 passed: plain labeled path and file-manager instruction, no printed launch command |
| Review: PowerShell printed hostile launch path, source-contract only | targeted 0 passed / 1 failed: `Write-Host` emitted raw path in `&` command | targeted 1 passed: plain labeled executable path and file-manager instruction; hostile-path text substitution checked as data, not PowerShell execution |

PowerShell targeted commands used `node --test --test-name-pattern='<behavior>' tests/install-scripts.test.cjs`. These RED/GREEN observations establish **textual source contracts only**, never PowerShell parser/native execution. `command -v pwsh` found no executable; no PowerShell was downloaded or installed. The optional parser test explicitly skips when unavailable.

Additional executable-fixture regressions were added for already-working fail-closed behavior (not falsely represented as new RED fixes): clone, npm ci, native rebuild, build and package failures with stale runnable output; successful read-only checks; missing gh/node/npm/git; and real local Git source-ref selection. Each fixture invocation has a new scratch HOME/TMPDIR/controlled PATH, no inherited credentials or real gh/npm, and a Node fixture shebang derived from `process.execPath`. Required POSIX utilities are discovered, not assumed at host-specific paths. Only fixture-owned paths are installed/copied/deleted. No actual host-system installation occurred.

The real local-Git regression creates isolated default `main` and feature commits, clones via `file://` with the bootstrap's actual depth/branch arguments, and requires the feature marker before the fixture build succeeds. Its original checkout remains on `main` unchanged. These local fixture commits are not changes/commits to the RiftTask working repository, and no network or credential helper is used.

## Final real execution

- `node --test tests/install-scripts.test.cjs`: **23 tests: 22 passed, 0 failed, 1 skipped**. Skip: PowerShell parser unavailable. Includes relative-TMPDIR rejection/no-leak sentinel preservation, hostile macOS printed-path regression and PowerShell plain-output source contract, plus prior fixtures.
- `npm test`: exit **0**. Core/integration: **136 tests, 135 passed, 0 failed, 1 skipped** (same PowerShell parser gate). Renderer: **40 passed**, four files. Full output recorded during execution at scratch `rifttask-review-npm-test.log`; it is not a committed artifact.
- `npm run build`: exit **0**; Vite 8.3.5, 21 modules, existing >500 kB chunk warning. Output recorded at scratch `rifttask-review-build.log`. No new UI changes or screenshots are claimed.
- `git diff --check` and `git diff --cached --check`: exit **0**.
- Actual installed dependency engines read from local package metadata: Vite `^20.19.0 || >=22.12.0`, Vitest `^22.12.0 || ^24.0.0 || >=26.0.0`, jsdom `^22.22.2 || ^24.15.0 || >=26.0.0`. The bootstrap deliberately supports the conservative subset Node 24.15+ in 24.x or >=26; Node 22 is not offered by this preview.

## Native acceptance / parent handoff

| Gate | Evidence / remaining action |
| --- | --- |
| Linux installer control flow | Executed Bash against real scratch filesystem and controlled executable fixtures. Not a real dependency build/install or Electron launch. |
| macOS x64/ARM64 | OS/path logic simulated using executable fixtures on Linux. Actual macOS copy semantics, compiler/dependency build, Gatekeeper/signing and GUI launch remain unverified. |
| Windows x64/ARM64 | Source-contract checks only. PowerShell parser/runtime unavailable; native exit/failure/cwd/literal `[ ]` paths/reparse-point preservation/ARM64 packaging and launch need execution on Windows. No regex result substitutes for that gate. |
| Existing install/data | Real POSIX file/directory/symlink fixture preservation verified. Native Windows reparse-point and macOS bundle behavior still require platform tests. No real application data accessed. |
| Publication | Parent independently reviews, reruns tests, handles any source commit/private feature push/draft-PR readback. This worker made no source commit, push, merge, release, workflow push, auth/scope change or cloud/data-repository call. Parent `docs/TODAY.md` edit left untouched. |

Before claiming native installation support, run the README preview on each target OS/architecture with a genuinely new destination and synthetic app data only. Exercise failed clone/install/rebuild/build/package, stale/missing/wrong-architecture output, failed auth in check mode, literal metacharacter paths, all existing destination types and read-only check/cwd cleanup. Validate actual packaged PTY and Electron launch without disabling platform protections. Preserve any old app and data. Keep the delivery draft while these gates are open.
