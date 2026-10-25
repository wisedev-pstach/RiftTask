# GitHub CLI GUI executable discovery — 2026-10-25

## Bounded scope

The default identity adapter now finds installed official `gh` when desktop GUI PATH is incomplete. This is the executable-discovery part of onboarding, NOT automatic native-terminal login. No auth credentials changed, no identity/workspace cache written by live smoke, no issues/tasks fetched, no tokens exposed.

- PATH `gh` remains first.
- macOS fallbacks: `/opt/homebrew/bin/gh`, `/usr/local/bin/gh`.
- Windows fallbacks: `ProgramFiles/GitHub CLI/gh.exe`, per-user `LOCALAPPDATA/Programs/GitHub CLI/gh.exe`, WinGet `LOCALAPPDATA/Microsoft/WinGet/Links/gh.exe` (Windows path joining).
- Linux fallbacks: `/usr/local/bin/gh`, `/usr/bin/gh`, absolute `HOME/bin/gh`; this covers this host's `/opt/data/bin/gh` without a host-specific path in product code.
- Only ENOENT triggers another candidate. Credential rejection, permission denial, timeout and other errors stop discovery. Relative/control-character environment roots are ignored. Standard system/user install directories and the launch environment are trusted, not an OS security boundary.
- Auth preserves `gh api user --hostname github.com`, `shell:false`, 15-second per-attempt timeout, 64-KiB output cap and hidden noninteractive Windows process. No shell interpolation, download, executable search in project files, or token persistence added.

## Actual RED → GREEN evidence

Baseline `npm test`: 39 core/integration + 15 renderer passed.

1. Wrote first discovery behavior and a no-op module interface. `node --test tests/gh.test.cjs` failed 1/1: expected `verified identity`, received undefined. Implemented macOS fallback: 1/1 passed.
2. Added platform candidate tests. Same command failed 2/4: Windows/Linux incorrectly received macOS candidates. Added platform-specific known installation roots: 4/4 passed.
3. Added default-auth subprocess integration. `node --test tests/auth.test.cjs` failed 1/7: expected verified fixture account but received account:null/ghAvailable:false. Wired default auth runner to discovery: targeted auth/discovery 11/11 passed.
4. Added supplemental safety regression coverage: PATH preference, non-ENOENT stops (including a fallback failure), relative/control-character roots, preservation of args and process limits. These already-supported behaviors passed without production changes.

The Linux integration runs an actual executable fixture under a temporary home, with non-fixture launch candidates forced missing in the child process. This prevents test machines with system gh from touching live credentials/network. Fixture identity is explicitly test data, not live-account evidence. All fixture files are removed by test cleanup.

## Review and final verification

Independent read-only reviewer inspected tracked and new modules/tests plus surrounding auth, returned passed:true with no security or logic blockers. Nonblocking suggestions for fallback-error stopping and maxBuffer/windowsHide assertions were added as tests. Native-platform smoke remains outstanding.

Final actual commands:

- `npm test`: **50 core/native/integration + 15 renderer passed**, zero failures/skips.
- `npm run build`: Vite production build passed (16 modules transformed).
- `node --check desktop/gh.cjs` and `node --check desktop/auth.cjs`: exit 0.
- `git diff --check`: exit 0.
- `node /opt/data/cache/scratch/rifttask-gh-discovery-smoke.cjs`: PASS — real default auth runner found the host's installed gh and verified live GitHub identity; no injected runner, no cachePath/workspace writes, no account details printed. Scratch script uses createAuth().session() and asserts account/non-offline/ghAvailable.
- `gh repo view wisedev-pstach/RiftTask --json visibility,url`: PRIVATE.
- Disk check: 18 GB available on /opt/data before build.

The first combined verification command was blocked before execution by cron's inline `node -e` approval rule. Tests/build were rerun without inline evaluation; read-only live auth smoke used the explicit scratch script above. No runtime approval settings changed.

## Still not verified/delivered

No native Windows/macOS execution. This host still cannot run Electron GUI without GTK. Native login terminal onboarding, backup import/export, authenticated one-command installers, platform packaging/CI/release and final acceptance remain unfinished. Workflow scope remains unavailable; no workflow permission workarounds, releases or public publication performed.
