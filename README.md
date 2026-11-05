# RiftTask

Keep projects, tasks and an interactive terminal in one desktop workspace—without importing a backlog from GitHub or Azure DevOps.

- Group projects into categories and track tasks in **Backlog → In progress → Done**.
- Add milestone labels, priorities, due dates and a Today list.
- Keep a per-project terminal session alive while switching tabs.
- Save locally, export backups, and optionally sync manually through your own private GitHub repository.

## Install

**Have Git, Node 24.15+ (24.x) or 26+, and npm/npx installed.** Internet access and build space are required. Mac/Windows x64 and ARM64 use shipped native terminal binaries: **no C++ compiler, Visual Studio or Python required**. Linux still needs Python 3, make, a C/C++ compiler and Electron's desktop libraries.

### macOS / Linux · Terminal

```sh
bash -o pipefail -c 'curl -fsSL https://raw.githubusercontent.com/wisedev-pstach/RiftTask/main/scripts/install.sh | bash'
```

### Windows · PowerShell

```powershell
irm https://raw.githubusercontent.com/wisedev-pstach/RiftTask/main/scripts/install.ps1 | iex
```

These commands execute downloaded code and build public `main` in a temporary directory. No GitHub login or `gh` is needed to install. On Mac/Windows, close RiftTask and rerun the same command to update a recognized installation; task data stays untouched and the previous app backup is kept. Keep OS security controls enabled.

**Open the app yourself after setup:**

- Mac: `~/Applications/RiftTask.app`
- Windows: `%LOCALAPPDATA%\Programs\RiftTask\RiftTask.exe`
- Linux: `~/.local/bin/rifttask`

## Start working

Install the official [GitHub CLI](https://cli.github.com/) **for app sign-in**, then open RiftTask and sign in with GitHub. An existing verified CLI login is reused. Create a category, add a project, and add your first task; choose a local project directory only if you want Git status or the terminal.

**Local-first.** Cloud sync is optional and manual, using a separate private repository you own. Git history is plaintext, not end-to-end encrypted; anyone with repository access can read synced planning data. Local paths and terminal output do not sync.

> **Source-build preview, not a signed binary release.** Setup verifies the terminal inside Electron before installing. Native Mac/Windows installation and launch remain unverified on this Linux development host; fixture tests are not native platform proof.

[Detailed setup, troubleshooting, safety and development](docs/SETUP.md) · [Installer evidence](docs/installer-evidence.md) · [Native prebuild evidence](docs/native-prebuild-evidence.md)
