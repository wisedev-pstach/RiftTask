# Functional completion — 3 November 2026

Implemented on `feat/cloud-persistence`, starting from `126f4a87f2326c3722653d5d54566744f4b70178`. These changes are local for parent review/publication; this worker made no commit, push, merge, release, auth change or cloud call. The owner's latest `docs/TODAY.md` entry was not edited. Parent publication verification on 4 November: independent security/correctness review found no blockers (55 targeted passed, 1 skipped). Fresh parent `npm test` returned **153 core/integration passed, 1 PowerShell skip; 42 UI passed**; build and whitespace passed. Native manual testing belongs to the owner and is not a precondition to publishing this implemented source handoff.

## Delivered behavior

### 1. Actual in-app sign-in initiation

- `Sign in with GitHub` verifies/reuses the official CLI identity first. An API failure is not enough to launch: a working `gh auth status --hostname github.com` also prevents replacing shared CLI authentication. Network/missing executable/invalid identity failures do not silently launch or claim verification.
- For an unauthenticated CLI, macOS uses fixed `/usr/bin/osascript` and Terminal, passing shell-quoted executable/fixed arguments as argv rather than interpolating renderer text into AppleScript. Windows uses the native system PowerShell to `Start-Process` a separate visible PowerShell console with default streams, `-NoProfile`, `-NoExit`, and encoded **literal** fixed `gh` arguments. Device-code/prompts are not discarded into `stdio:ignore`. No execution-policy bypass.
- Discovery returns an absolute, `gh --version`-checked executable from the installed PATH/known official CLI locations. This is installed-CLI discovery, not a cryptographic binary-provenance claim. Windows roots and executable paths reject control characters/relative paths; all launch errors are sanitized.
- Only fixed `auth login --hostname github.com --git-protocol https --web` is launched. No shared `gh auth logout`, token command, added scopes, renderer command/URL/path or token response. Linux/native failure gives the exact manual command.
- A launched terminal returns `{account:null,offline:false,ghAvailable:true,loginPending:true}`. It does **not** open a workspace or pretend authentication. The UI disables duplicate pending launches. `Check sign-in` verifies only; failed checks allow an explicit retry without automatically launching another terminal.
- Auth queue/disconnect generation and pre-launch discovery guards cancel stale pending launches/results. A terminal already opened remains the user's independent native process; app-local disconnect does not revoke shared CLI auth.

### 2. Non-destructive recovery from exported backup

- A verified account with a workspace load error can use **Import backup**. Editing/export remain disabled until a valid workspace exists; no sample/empty workspace is seeded over corrupt data.
- The existing native single-file chooser supplies the input path. The renderer still sends **zero arguments**. Bounded descriptor reads use regular-file checks, no-follow/nonblocking where supported, fstat size checks, a limit+1 read bound, and v1 schema/reference validation before restore.
- The renderer explains replacement and archives; a second **native**, default-cancel confirmation is enforced in main/service after validation. The service defaults to refusing confirmation if no trusted callback is provided.
- Identity and generation are checked around selection/validation/confirmation and immediately before synchronous store mutation. Switching away and back to the same numeric account also invalidates the old operation.
- New internal `store.restore(id,workspace)` derives all persistence paths from the verified numeric account. If primary is corrupt, it exclusively creates `accounts/<id>/recovery-<random>/`, copies **every existing primary and rolling backup unchanged**, chmods/fsyncs those archive files, then atomically writes the validated primary. Archives are never rotated/reused/deleted by the app; a later ordinary save can rotate `.bak` without touching archived originals.
- Cancellation/invalid input/identity errors do not create archives or replace originals. Injected archive-copy and atomic-rename failures preserve corrupt primary AND backup byte-for-byte. A partial new archive may remain after failure; original files stay in place. Errors do not expose raw filesystem details.
- Healthy-workspace import retains the existing rolling-safety-copy behavior. Unsupported I/O errors, symlink account paths and non-regular originals fail closed; they are not treated as permission to seed or delete data.

### 3. Practical authenticated source-build handoff

- README now contains one Bash command and one PowerShell command block, with prerequisites and no-existing-source/destination checks. They authenticated-clone private `feat/cloud-persistence`, capture its full SHA, and invoke implemented `--ref <sha>` / `-Ref <sha>` source-build scripts.
- Both scripts validate a full lowercase 40-character SHA, fetch using the official gh credential helper scoped to that one Git invocation (no shared credential/config modification), checkout detached, verify/print the exact SHA **before npm**, and build/package into fresh owned scratch directories. A feature-branch advance cannot change the captured build revision.
- The known starting base `126f4a8` alone lacks this work. Parent must publish the reviewed changes first; the README command then captures that newly published head. No invented future SHA or claim that local changes already exist remotely.
- Existing final app/launcher destinations are still refused. No destructive upgrade, old-data migration/deletion, quarantine stripping, security/PowerShell-policy bypass, shared shortcuts or automatic app launch. Source-build bootstraps are **not prebuilt release download installers**, signed/notarized releases or native platform verification.

## Tests and observed RED → GREEN

Each implementation slice was preceded by its failing behavior test, run with the real test runner:

1. `node --test tests/login-flow.test.cjs`: RED because login only verified and threw; GREEN after pending/native-login delegation. Further observed RED/GREEN for disconnect-before-queued-login and in-flight disconnect cancellation.
2. `node --test tests/login-launch.test.cjs`: RED for missing native launch/discovery behavior; GREEN for fixed launch contracts and Linux fallback. Discovery-disconnect guard was separately RED/GREEN. Windows console-stream contract was corrected through RED/GREEN so gh prompts aren't lost to ignored streams.
3. `npx vitest run src/App.test.jsx -t 'starts native login'`: RED for absent pending state/verification-only check; GREEN after UI and bridge wiring. Explicit retry after failed check also observed RED/GREEN.
4. `node --test tests/recovery.test.cjs`: RED because both corrupt files blocked import and no native confirmation was called; GREEN with service/store restore. Raw archive/rename error sanitization separately observed RED/GREEN. Real scratch files, not invented JSON responses, prove archives and byte preservation.
5. `npx vitest run src/App.test.jsx -t 'allows exported-backup'`: RED because import was disabled with no loaded workspace; GREEN after load-error recovery UI/consent wiring. Cancellation never calls save or seeds data.
6. Real Git/executable installer pin fixture: RED because `--ref` was unknown; GREEN after full-SHA fetch/checkout/verification. PowerShell `-Ref` source contract separately RED/GREEN; **not** PowerShell runtime evidence.

Latest full execution:

| Command/check | Actual result |
| --- | --- |
| `npm test` | **153 core/integration passed, 1 skipped; 42 renderer passed** |
| PowerShell parser test | Skipped: `pwsh` unavailable; not a Windows pass |
| `npm run build` | PASS; known >500 kB bundled xterm/renderer chunk warning remains |
| `node --check` over desktop/tests CJS files | **39 files PASS** |
| `bash -n scripts/install.sh` | PASS |
| `git diff --check` | PASS |
| `npm audit --omit=dev --audit-level=high` | PASS: **0 vulnerabilities** (production dependencies only) |

Full test output: `/opt/data/cache/scratch/rifttask-functional-tests.log` (scratch, not a committed artifact).

Executable/path evidence is deliberately scoped:
- Actual shell fixture executes the generated macOS command against a scratch dummy gh executable with quotes/metacharacters in its pathname and proves the exact fixed argv. It does not execute macOS Terminal or authenticate.
- Real local Git fixtures verify feature selection, fetching an older pinned revision despite a newer branch tip, exact SHA output, and the **exact README Bash command** through a successful isolated dummy package copy. Re-running the recipe refuses an existing source checkout before external commands. Fake gh/npm/package executables never access real credentials/network/app data.
- Existing installer fixtures still cover no-overwrite, hostile literal paths/arguments, ARM64 output selection, failed clone/build/rebuild/package, missing tools, and quarantine preservation. Windows checks remain source/launch contracts, not native evidence.

## Real Chromium built-UI smoke — explicitly mocked bridge

Executed `/opt/data/cache/scratch/rifttask-functional-browser.cjs` using the user's specified Playwright-core/Chromium paths. It serves the actual production `dist` renderer over an owned ephemeral loopback listener and injects a **mock bridge with dummy data**. Browser/server close in `finally`; no recurring job/service was created.

Actual browser result: login calls **1**, verification calls **1**, recovery imports **1**, workspace saves **0**, **0 page errors**. Assertions covered pending-not-authenticated state, explicit check before workspace, error-state import enabled/edit+export disabled, no import before consent, cancel without import, and dummy restored project after explicit restore.

Screenshots in `artifacts/screenshots/functional-completion-20261103/` (ignored artifacts):
- `mock-login-pending.png` — pending login, no authenticated workspace.
- `mock-recovery-error.png` — failed load, import available.
- `mock-recovery-confirmation.png` — archive/default-cancel guidance before import.
- `mock-recovery-restored.png` — dummy restored project.
- `browser-result.json` — raw browser assertions/counts.

Pending and recovery-confirmation screenshots were visually inspected. Every screenshot visibly labels **MOCKED BROWSER BRIDGE / DUMMY DATA / NO NATIVE LOGIN, DIALOG OR FILE RECOVERY EXECUTION**. Real archive/file recovery is tested separately in Node; the screenshots do not prove native behavior.

## Remaining owner checks / publishing boundary

- Native macOS/Windows login terminal/browser prompt behavior (including macOS Automation permission), source compilation/install/launch, real dialogs, account restart/isolation and packaged PTY belong to the owner's manual test pass.
- Current host check: `ldd node_modules/electron/dist/electron` still reports missing `libgtk-3.so.0`; no DISPLAY/WAYLAND_DISPLAY; `pwsh` unavailable. These prevent native host verification, **not implementation or source handoff**. No security controls were weakened to bypass them.
- Two physical devices, CI workflow permissions, signing/notarization and release publication remain separate unverified release gates. No new cloud repository or real task/CLI credential data was read/written in this pass.
- Parent independently reviews these files, commits/pushes the private feature branch/draft PR, and verifies remote SHA. No human native run is required before that reviewed source publication.
