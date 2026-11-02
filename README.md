# RiftTask

A desktop workspace for the projects you work on after work.

Organize **categories → projects → your own tasks**. Keep the next action visible without importing a second backlog from GitHub or Azure DevOps.

> **Status: foundation in development, not a released installer.** Work is staged over two days. See [build state](docs/BUILD-STATE.md) and the evidence files under `docs/` for what has actually been exercised.

## Product direction

- Category/project organization, task notes, priorities, due dates, and a small Today list.
- List and board views, search, and project context.
- GitHub identity through the **official GitHub CLI** on your computer. No borrowed OAuth client ID, embedded personal token, or hosted account database.
- Account-scoped local persistence, atomic writes and recoverable backups.
- GitHub / Azure DevOps repository links, local Git context, and opening your project in a native terminal. No automatic provider issue/task importing and no automatic command execution.
- Windows/macOS packages and authenticated one-command installation from this private repository, once platform builds have been verified.

## Data and authentication

RiftTask is **local-first**, not cloud-synced. Each verified numeric GitHub account ID gets a separate workspace beneath Electron's application-data directory. Signing out does not delete tasks or revoke the shared GitHub CLI login. File separation is a convenience boundary, **not encryption or protection from another user of the same OS account**. Local offline access is intended for the last verified identity; account switching must verify the new identity online.

GitHub tokens stay with the official CLI. The renderer never receives tokens and cannot execute shell commands. A future optional sync feature must be explicit; a GitHub login alone does not imply cross-device synchronization.

## Development

Use Node.js 24 LTS or newer and npm. Install the official [GitHub CLI](https://cli.github.com/) and sign in on **your own computer**:

```sh
gh auth login --hostname github.com --git-protocol https --web
```

Then, from this private repository:

```sh
npm ci
npm test
npm run build
npm start
```

`npm run dev` serves the renderer for UI work only; it is **not** a desktop sign-in or persistence substitute. The real desktop app loads the built local files.

## Installation

RiftTask can be installed in a single command using your authenticated GitHub CLI (`gh`).

### macOS (Terminal)
Prerequisites: official GitHub CLI (`gh auth status`), Git, and Node.js v20+ (`brew install gh node git`):

```sh
gh repo clone wisedev-pstach/RiftTask /tmp/rifttask-install && /tmp/rifttask-install/scripts/install.sh && rm -rf /tmp/rifttask-install
```

This compiles native dependencies for your Mac's architecture (Apple Silicon / Intel), packages the application, and installs `RiftTask.app` into `/Applications` (or `~/Applications`). Launch with:

```sh
open /Applications/RiftTask.app
```

### Windows (PowerShell)
Prerequisites: official GitHub CLI (`gh auth status`), Git, and Node.js v20+:

```powershell
gh repo clone wisedev-pstach/RiftTask "$env:TEMP\rifttask-install"; & "$env:TEMP\rifttask-install\scripts\install.ps1"; Remove-Item -Recurse -Force "$env:TEMP\rifttask-install"
```

This packages RiftTask, installs it to `%LOCALAPPDATA%\Programs\RiftTask`, and creates Start Menu and Desktop shortcuts.

### Checking Prerequisites
You can inspect your machine's environment and prerequisite status without modifying anything:

- macOS / Linux: `./scripts/install.sh --check`
- Windows: `powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1 -Check`

## Verification

Core tests: `npm run test:core` (Node's built-in runner). Renderer tests: `npm run test:ui` (Vitest and Testing Library). Production renderer build: `npm run build`.

Native Windows/macOS behavior is only considered verified after execution on those operating systems; Linux unit/build success is not evidence that their installers work.
