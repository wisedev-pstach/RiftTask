# RiftTask

A desktop workspace for the projects you work on after work.

Organize **categories → projects → your own tasks**. Keep the next action visible without importing a second backlog from GitHub or Azure DevOps.

> **Status: functional source-build preview; native owner testing remains.** In-app native GitHub CLI sign-in initiation and non-destructive exported-backup recovery are implemented. Manual cloud storage and Linux PTY behavior have real-path evidence; Windows/macOS installation and GUI acceptance remain unverified, not prerequisites to publishing this source handoff. See [functional evidence](docs/functional-completion-evidence.md), [final scope](docs/FINAL-SCOPE.md) and [build state](docs/BUILD-STATE.md).

## Product direction

- Category/project organization, task notes, priorities, due dates, and a small Today list.
- List and board views, search, and project context.
- GitHub identity through the **official GitHub CLI** on your computer. No borrowed OAuth client ID, embedded personal token, or hosted account database.
- Account-scoped local persistence, atomic writes and recoverable backups.
- Project-first tiles/counts, milestone labels/task assignments and milestone completion view.
- GitHub / Azure DevOps repository links, local Git context, and an explicitly started bottom-docked terminal retaining per-project sessions. No automatic provider issue/task importing or project command execution.
- Authenticated one-command Windows/macOS **source-build bootstrap** from this private repository; native packages/install/launch still require the owner's platform checks.

## Data and authentication

RiftTask is **local-first, with optional manual cloud sync**. Each verified numeric GitHub account ID gets a separate workspace beneath Electron's application-data directory. Explicit cloud opt-in uses a separate existing initialized private personal GitHub data repository for planning data, including projects whose code lives in Azure DevOps. It does not write task data into code repositories. Signing out does not delete tasks or revoke the shared GitHub CLI login. File separation is a convenience boundary, **not encryption or protection from another user of the same OS account**. Local offline access is intended for the last verified identity; account switching must verify the new identity online.

GitHub tokens stay with the official CLI; the renderer never receives them. The terminal's narrowly scoped bridge permits interactive shell input only after explicit start, under your OS permissions; it is not a command sandbox. Sign-in alone does not enable cloud transfer. Use **Cloud persistence → verify dedicated repository → consent → Sync now**; pulls require confirmation and conflicting copies are not overwritten. Cloud snapshots preserve tasks/milestones but exclude device paths and terminal output. Private Git history is plaintext, not end-to-end encrypted; anyone with repository read access can read it, and disabling sync does not erase history. Real GitHub transfer between two local stores was verified with dummy data; two physical native devices remain unverified. See [cloud evidence](docs/cloud-live-evidence.md).

## Development

In the desktop app, **Sign in with GitHub** first verifies/reuses an existing CLI account. Only when the CLI reports no working login does it start the fixed official `gh auth login --hostname github.com --git-protocol https --web` flow in Terminal (macOS) or Windows PowerShell. Finish the terminal/browser prompts, then **Check sign-in** (verification only). Opening a terminal is **pending, not authenticated**. A failed check permits an explicit retry; it never automatically launches another login. Linux, missing CLI, or a denied native-terminal launch gives the manual command below. No shared `gh auth logout`, scope expansion, or token-returning bridge is used.

If workspace loading fails, **Import backup** remains available; **Export backup** and editing stay disabled. Choose an existing exported JSON backup (regular file, at most 8 MiB, valid v1 schema) and confirm the native restore dialog. For a corrupt primary, **both existing primary and rolling backup** are copied byte-for-byte into a uniquely created `accounts/<verified numeric ID>/recovery-<random>/` archive before atomic replacement. These archives are never rotated or deleted by RiftTask. Cancellation, validation/account-change errors and pre-replacement write failures preserve both originals. Keep the archives and original export; never delete corrupt files just to make loading succeed.

Use Node.js 24.15+ (24.x LTS) or 26+ and npm. Install the official [GitHub CLI](https://cli.github.com/) and sign in on **your own computer**:

```sh
gh auth login --hostname github.com --git-protocol https --web
```

Then, from this private repository:

```sh
npm ci
npm test
npm run native:rebuild
npm run build
npm start
```

`npm run dev` serves the renderer for UI work only; it is **not** a desktop sign-in or persistence substitute. The real desktop app loads the built local files.

## Source-build installation preview (not a released installer)

These scripts are a **source-build preview**, not verified native installers or an upgrade mechanism. Native Windows/macOS installation and launch have **not** been exercised here. No signed/notarized release assets are being offered. Do not disable Gatekeeper, quarantine, Windows security controls, or PowerShell execution policy to run this preview.

Prerequisites on **your own computer**:

- Official GitHub CLI in `PATH`, authenticated for this private repository (`gh auth status --hostname github.com`), and Git.
- **Node 24.15+ within 24.x (recommended), or Node 26+**, with npm/npx. This conservative bootstrap baseline satisfies the current installed Vite (`^20.19.0 || >=22.12.0`), Vitest (`^22.12.0 || ^24.0.0 || >=26.0.0`) and jsdom (`^22.22.2 || ^24.15.0 || >=26.0.0`) engines. Node 20 alone is insufficient. Dependency/lockfile updates may change these requirements.
- Native `node-pty` compilation: Python 3 and a C/C++ toolchain. macOS: Xcode Command Line Tools. Windows: Visual Studio Build Tools with Desktop development with C++ and a suitable Windows SDK. Linux: `make`, a C/C++ compiler, Python 3, and Electron's desktop runtime libraries/display. Use a Node/toolchain architecture matching the intended app.
- Network access for the private source, npm dependencies and Electron/build tooling; adequate build disk space. This is not an offline or dependency-free installer. Unset production-only npm settings so development/build dependencies are installed.

### macOS / Linux — Bash

After the reviewed changes are pushed to private `feat/cloud-persistence`, run this **one shell command** from a directory where `RiftTask-source-preview` does **not** already exist:

```sh
test ! -e RiftTask-source-preview && test ! -L RiftTask-source-preview && gh repo clone wisedev-pstach/RiftTask RiftTask-source-preview -- --depth=1 --branch feat/cloud-persistence && ref="$(git -C RiftTask-source-preview rev-parse HEAD)" && bash RiftTask-source-preview/scripts/install.sh --ref "$ref"
```

The initial authenticated clone selects the **moving feature branch**, then captures its full commit SHA. `--ref` fetches, checks out detached, verifies and prints that exact commit in a separate fresh build tree; a branch advance during the build cannot silently change the built revision. Keep the printed SHA for reporting. This is reproducible source selection, **not signed release provenance**. The implementation starts at known base `126f4a87f2326c3722653d5d54566744f4b70178` plus the functional changes published by the parent; pinning only that older base omits them. Do not substitute default `main`: it may lack the current feature/bootstrap. For a supplied reviewed full SHA use `--ref '<40-character lowercase SHA>'` / `-Ref '<SHA>'`; unsupported or unavailable refs fail closed.

Defaults: macOS `~/Applications/RiftTask.app`; Linux `~/.local/share/rifttask` with launcher `~/.local/bin/rifttask` (add that directory to your `PATH` yourself if needed). `--dest '/absolute/new/path'` means the **exact final application directory**, not a parent; on macOS it must end in `.app`.

### Windows — PowerShell (native validation pending)

Use a normal PowerShell session whose existing policy permits local scripts. This is **one PowerShell command** (the `& { ... }` block); every native failure stops the handoff:

```powershell
& { $ErrorActionPreference = 'Stop'; if (Get-Item -LiteralPath RiftTask-source-preview -Force -ErrorAction SilentlyContinue) { throw 'Source destination exists; choose a new directory' }; gh repo clone wisedev-pstach/RiftTask RiftTask-source-preview -- --depth=1 --branch feat/cloud-persistence; if ($LASTEXITCODE -ne 0) { throw 'Source clone failed' }; $Ref = git -C RiftTask-source-preview rev-parse HEAD; if ($LASTEXITCODE -ne 0) { throw 'Source revision failed' }; powershell -NoProfile -File .\RiftTask-source-preview\scripts\install.ps1 -Ref $Ref; if ($LASTEXITCODE -ne 0) { throw 'Source build/install failed' } }
```

Default: `%LOCALAPPDATA%\Programs\RiftTask`. `-Dest 'C:\absolute\new\path'` selects the exact final directory. No shared Desktop/Start Menu shortcuts are created by this preview. Launch the resulting `RiftTask.exe` directly after native validation; the bootstrap does not launch the app automatically.

### Preservation and limits

- **Every existing final destination is refused**, including an empty directory, file, symlink/reparse point or existing app. On Linux an existing `~/.local/bin/rifttask` is also refused. No automatic uninstall, replacement or upgrade; choose a genuinely new destination. Do not remove your old install/data just to satisfy the script.
- No application-data migration/deletion, credential changes, quarantine stripping or security bypass. Existing data remains in Electron's normal account-scoped application-data location; a new app directory is not a separate data profile.
- Build/clone failures stop before destination creation. A failed copy or interruption can leave a **new, partial destination** (and possibly a new launcher); it is not automatically deleted. Inspect it manually before choosing another path. Only the invocation's owned temporary build tree is cleaned up.
- `--check` / `--dry-run` and `-Check` / `-DryRun` do not clone, build, create directories/shortcuts, log in or alter app data. They fail on missing tools, unsupported Node/architecture, failed CLI authentication or an existing destination. They inspect tools/authentication, **not full compiler availability, private-repository access, dependency downloads, signing or successful native launch**.
- Current evidence: [installer evidence](docs/installer-evidence.md). Linux executable-fixture tests and simulated macOS path selection are **not** native macOS/Windows installation proof. PowerShell runtime was unavailable on the verification host; source-contract checks are not runtime evidence.

## Verification

Core tests: `npm run test:core` (Node's built-in runner). Renderer tests: `npm run test:ui` (Vitest and Testing Library). Production renderer build: `npm run build`.

Native Windows/macOS behavior is only considered verified after execution on those operating systems; Linux unit/build success is not evidence that their installers work.

The owner performs native macOS/Windows testing after the parent publishes the reviewed private branch. The implementation is not withheld pending those manual tests. No prebuilt release, signing/notarization, security bypass or native-platform success is implied by the source commands or browser screenshots.
