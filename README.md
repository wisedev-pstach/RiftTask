# RiftTask

A desktop workspace for the projects you work on after work.

Organize **categories → projects → your own tasks**. Keep the next action visible without importing a second backlog from GitHub or Azure DevOps.

> **Status: source-build preview; release scope is not complete.** Manual cloud storage and Linux PTY behavior have real-path evidence; Windows/macOS installation and GUI acceptance remain open. See [final scope](docs/FINAL-SCOPE.md), [build state](docs/BUILD-STATE.md) and the evidence files under `docs/`.

## Product direction

- Category/project organization, task notes, priorities, due dates, and a small Today list.
- List and board views, search, and project context.
- GitHub identity through the **official GitHub CLI** on your computer. No borrowed OAuth client ID, embedded personal token, or hosted account database.
- Account-scoped local persistence, atomic writes and recoverable backups.
- Project-first tiles/counts, milestone labels/task assignments and milestone completion view.
- GitHub / Azure DevOps repository links, local Git context, and an explicitly started bottom-docked terminal retaining per-project sessions. No automatic provider issue/task importing or project command execution.
- Windows/macOS packages and authenticated one-command installation from this private repository, once platform builds have been verified.

## Data and authentication

RiftTask is **local-first, with optional manual cloud sync**. Each verified numeric GitHub account ID gets a separate workspace beneath Electron's application-data directory. Explicit cloud opt-in uses a separate existing initialized private personal GitHub data repository for planning data, including projects whose code lives in Azure DevOps. It does not write task data into code repositories. Signing out does not delete tasks or revoke the shared GitHub CLI login. File separation is a convenience boundary, **not encryption or protection from another user of the same OS account**. Local offline access is intended for the last verified identity; account switching must verify the new identity online.

GitHub tokens stay with the official CLI; the renderer never receives them. The terminal's narrowly scoped bridge permits interactive shell input only after explicit start, under your OS permissions; it is not a command sandbox. Sign-in alone does not enable cloud transfer. Use **Cloud persistence → verify dedicated repository → consent → Sync now**; pulls require confirmation and conflicting copies are not overwritten. Cloud snapshots preserve tasks/milestones but exclude device paths and terminal output. Private Git history is plaintext, not end-to-end encrypted; anyone with repository read access can read it, and disabling sync does not erase history. Real GitHub transfer between two local stores was verified with dummy data; two physical native devices remain unverified. See [cloud evidence](docs/cloud-live-evidence.md).

## Development

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

From a directory where `RiftTask-source-preview` does **not** already exist:

```sh
gh repo clone wisedev-pstach/RiftTask RiftTask-source-preview -- --depth=1 --branch feat/cloud-persistence &&
bash RiftTask-source-preview/scripts/install.sh --check &&
bash RiftTask-source-preview/scripts/install.sh
```

The bootstrap **always clones a fresh `feat/cloud-persistence` build tree**, even when invoked from a checkout; it does not build or modify that checkout. This is an explicit **moving feature branch**, not an immutable signed release or commit pin. Do not substitute default `main`: it may lack the current feature/bootstrap.

Defaults: macOS `~/Applications/RiftTask.app`; Linux `~/.local/share/rifttask` with launcher `~/.local/bin/rifttask` (add that directory to your `PATH` yourself if needed). `--dest '/absolute/new/path'` means the **exact final application directory**, not a parent; on macOS it must end in `.app`.

### Windows — PowerShell (native validation pending)

Use a normal PowerShell session whose existing policy permits local scripts. These explicit exit checks stop the recipe after a failed clone or check:

```powershell
gh repo clone wisedev-pstach/RiftTask RiftTask-source-preview -- --depth=1 --branch feat/cloud-persistence
if ($LASTEXITCODE -ne 0) { throw 'Source clone failed' }
powershell -NoProfile -File .\RiftTask-source-preview\scripts\install.ps1 -Check
if ($LASTEXITCODE -ne 0) { throw 'Prerequisite check failed' }
powershell -NoProfile -File .\RiftTask-source-preview\scripts\install.ps1
if ($LASTEXITCODE -ne 0) { throw 'Source build/install failed' }
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

Sign-in currently verifies a CLI account; it does **not** launch the authentication flow. Complete the `gh auth login` command above first. If both the current workspace and its rolling backup are corrupt, the app preserves them and blocks replacement; self-service recovery from an exported backup is not yet available in that state. Never delete originals to force a test to pass.
