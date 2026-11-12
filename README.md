# RiftTask

Keep projects, tasks and an interactive terminal in one desktop workspace—without importing a backlog from GitHub or Azure DevOps.

- Group projects into categories and track tasks in **Backlog → In progress → In review → Done**.
- Add milestone labels, priorities, due dates and a global In progress view (doing tasks only).
- Keep a per-project terminal session alive while switching tabs.
- Save locally, export backups, and optionally sync manually through your own private GitHub repository.

## Install

**Source-build preview, not a versioned GitHub release.** No GitHub releases have been published as of this source update. The commands below build the current public `main`, not a release tag. This source declares 0.4.0; unmerged feature branches are not installed by these commands. The installer reports its actual source HEAD and package version before building and again after successful installation. A version number alone does not identify an exact source commit.

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

- Mac: `~/Applications/RiftTask.app` (not `/Applications/RiftTask.app`, unless you chose that destination)
- Windows: `%LOCALAPPDATA%\Programs\RiftTask\RiftTask.exe`
- Linux: `~/.local/bin/rifttask`

### Check the installed version

Open **Settings** in the installed app to see the installed app version (0.3.0+). On macOS, quit all RiftTask instances and open the exact installed path above. To inspect that bundle without launching: `/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$HOME/Applications/RiftTask.app/Contents/Info.plist"`. If it still shows an old version, compare the installer’s reported source/version and destination, check for another copy pinned in the Dock, and retry only after a successful build. Failed setup is not an update; do not remove your task data or disable OS security protections.

## Start working

Install the official [GitHub CLI](https://cli.github.com/) **for app sign-in**, then open RiftTask and sign in with GitHub. An existing verified CLI login is reused. Create a category, add a project, and add your first task; choose a local project directory only if you want Git status or the terminal.

**Customize projects:** use each card’s **Edit** button or the project header’s **Edit project**. Change the name, category, preset/custom emoji, description, repository and local folder; Cancel leaves saved data untouched. For emoji, choose **Custom emoji…** and paste one emoji (including family/skin-tone/flag sequences). Update every syncing client to 0.3.0+ before syncing custom emoji; 0.2.0 rejects these icon values.

**Terminal:** a missing saved local folder disables Start. Click **Set local directory**, choose this device’s folder and **Save project** before starting. A nonempty old/Windows path does not itself disable the button, but native validation may reject it: use **Edit local directory** and save the correct local path. Nothing is automatically migrated or executed. macOS project shells use fixed `/bin/zsh -f` (no user rc files); Linux uses Bash and Windows uses PowerShell. The Bash installer command above is intentional and separate.

**Local-first.** Cloud sync is optional and manual, using a separate private repository you own. Git history is plaintext, not end-to-end encrypted; anyone with repository access can read synced planning data. Local paths and terminal output do not sync.

> **Source-build preview, not a signed binary release.** Setup verifies the terminal inside Electron before installing. Native Mac/Windows installation and launch remain unverified on this Linux development host; fixture tests are not native platform proof.

[Detailed setup, troubleshooting, safety and development](docs/SETUP.md) · [Installer evidence](docs/installer-evidence.md) · [Native prebuild evidence](docs/native-prebuild-evidence.md)
