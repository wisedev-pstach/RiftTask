# RiftTask setup and operation

[Quick start](../README.md) · Detailed guide for setup, safety, development and verification.

A desktop workspace for the projects you work on after work.

Organize **categories → projects → your own tasks**. Keep the next action visible without importing a second backlog from GitHub or Azure DevOps.

> **Ready for your first MVP test.** Installation currently builds the app from source; there is no prebuilt/signed download. The commands below download the public `main` branch over HTTPS; no GitHub CLI or authentication is needed to download/build/install. Mac/Windows manual testing is yours; automated evidence and known limits are linked at the end.

## Start using RiftTask

### 1. Install the prerequisites on your computer

- **Both platforms (installation):** Git, **Node 24.15+ within 24.x or Node 26+**, and npm/npx. No paid GitHub plan or separate RiftTask server is required for the described setup, subject to GitHub's normal limits.
- **Mac:** Apple Silicon (arm64) or Intel (x64). The pinned node-pty package supplies N-API prebuilds; no Python or C++ compiler is needed for this installer.
- **Windows:** ARM64 or x64. Shipped node-pty N-API prebuilds replace Visual Studio/Python compilation. Run in a normal PowerShell session whose existing policy permits local scripts; do not bypass policy.

You do not need to install Electron separately. The setup downloads dependencies and Electron, verifies the shipped native terminal in Electron, then builds/packages the app. It needs internet access and free build space.

### 2. Separate installation from app sign-in

The source repository is **public**. Downloading, building and installing do **not** require `gh`, a GitHub login or repository access permission. The scripts do not install `gh`, log in, or change shared Git credential configuration.

**Before first use of the app**, install the official [GitHub CLI](https://cli.github.com/) on your computer. RiftTask still requires it for verified GitHub identity and optional private cloud access. If it is already signed into your intended account, keep that login; otherwise the app can initiate sign-in after installation. Public source does not make your planning data public or remove the app's identity requirement.

### 3. Run the setup command for your OS

- [Install on macOS or Linux](#install-on-macos-or-linux)
- [Install on Windows](#install-on-windows)

The commands download and execute the setup script, then build public `main` in a temporary directory and print where the app was installed. Run downloaded code only if you trust this repository. **The setup does not launch the app automatically.** This is a source build, not a binary download.

### 4. Open the installed app and sign in

- **Mac:** in Finder, open **Home → Applications → RiftTask.app** (`~/Applications/RiftTask.app`).
- **Windows:** open **Start**, search **RiftTask**, and select it. If indexing has not caught up, use **Start → All apps → RiftTask** or open **`%LOCALAPPDATA%\Programs\RiftTask\RiftTask.exe`** in Explorer. For older installations missing the shortcut, use the [discovery repair](#repair-windows-start-menu-discovery-without-reinstalling).
- **Linux:** use `~/.local/bin/rifttask` after checking your desktop runtime dependencies.

An already authenticated GitHub CLI account is reused. Otherwise select **Sign in with GitHub**, finish the Terminal/PowerShell and browser prompts, then select **Check sign-in**. A pending login is not an authenticated workspace. The UI never asks you to paste a token.

### 5. Create your workspace

1. Create a category, for example **Games**.
2. Add a project, for example **lose DOT**, inside it.
3. Create tasks and move them through **Backlog → In progress → Done**. Add dates, priorities, notes or milestone labels as needed.
4. In **Project details**, optionally add a GitHub/Azure DevOps repository link and choose a local checkout directory. The directory is needed for Git status and the embedded terminal—not for ordinary task tracking.
5. Explicitly start the bottom terminal when needed. The app does not run project commands automatically.

**You can start local-only.** Tasks save automatically under the signed-in account on this computer. No cloud repository, Azure login or issue import is needed to create tasks. Disconnecting does not delete local tasks or log the shared GitHub CLI out.

### 6. Optional: enable free manual cloud sync

1. Open **Settings → Cloud**. Choose **Use existing repository** for a separate private personal repository initialized with a README, or **Create private repository** and enter a new name (for example `RiftTask-Data`). Creation supports only the current personal GitHub account, never an organization, source or linked project repository.
2. To create, check creation-only consent and continue to the native exact-target confirmation (default: **Cancel**). This creates only the private repository and README—not a task snapshot. Creation does not enable cloud or expand CLI permissions. If the outcome is uncertain, inspect that exact repository on GitHub before retrying; an existing-name error never adopts it automatically.
3. **Verify repository**, review the plaintext/history disclosure and give explicit consent to enable manual cloud.
4. Press **Sync now** whenever you want to upload/check changes. On another computer, sign in with the same GitHub account, select the same data repository, enable it independently, then **Sync now** and confirm the offered download.

This stores planning data for **all your RiftTask projects**, including Azure DevOps-linked projects, in that one GitHub data repository. Code stays with its original provider. Cloud sync is **manual**, not automatic. Conflicts stop instead of silently overwriting data; preserve/export both copies before resolving them. Local checkout paths and terminal output do not sync; choose each computer's project directories separately.

Private Git history is **not end-to-end encrypted**. Anyone with repository read access can read synced task content; disabling sync does not erase its history. For dummy-data testing only, the existing dedicated `wisedev-pstach/RiftTask-Cloud-Test` repository is available—do not mix real tasks into it.

### Backups and common setup problems

- Use **Export backup** to keep a separate JSON copy. **Import backup** replaces the active workspace only after confirmation. It is also available if loading fails; damaged originals are preserved in recovery archives before restore. Keep your exported file and archives.
- **Updating on Mac/Windows:** close RiftTask and rerun the same installation command. Only a recognized RiftTask app is replaced, after a fresh successful build, native-runtime verification and packaging. Task data stays untouched; the previous app backup is kept at the printed path. Unrecognized/corrupt apps and unrelated destinations are refused—do not delete app data to force an update.
- **App sign-in: missing gh / wrong GitHub account:** install the official CLI and check `gh auth status --hostname github.com` in your own terminal before retrying. Do not paste credentials into chat or the app.
- **Native preparation failure:** check supported Node version, architecture and the exact missing-artifact/runtime error. Mac/Windows deliberately stop rather than compile; do not install a compiler to work around missing prebuilds. Linux native builds still require Python/C++ tools. Keep the error (and source SHA if using the advanced pinned setup) for a bug report; do not blanket-enable dependency scripts or weaken OS security controls.
- **Unsigned-app or script-policy warning:** keep platform protections enabled and report the exact message. There is no signed/notarized release claimed here.
- **New app folder, old tasks still visible:** app installation location and application-data location are separate. Use a fresh OS test account for isolated dummy tests; a new clone alone is not a new data profile.

## Product direction

- Category/project organization, task notes, priorities, due dates, and a small Today list.
- List and board views, search, and project context.
- GitHub identity through the **official GitHub CLI** on your computer. No borrowed OAuth client ID, embedded personal token, or hosted account database.
- Account-scoped local persistence, atomic writes and recoverable backups.
- Project-first tiles/counts, milestone labels/task assignments and milestone completion view.
- GitHub / Azure DevOps repository links, local Git context, and an explicitly started bottom-docked terminal retaining per-project sessions. No automatic provider issue/task importing or project command execution.
- Anonymous HTTPS Windows/macOS **source-build bootstrap** from this public repository; native packages/install/launch still require the owner's platform checks.

## Data and authentication

RiftTask is **local-first, with optional manual cloud sync**. Each verified numeric GitHub account ID gets a separate workspace beneath Electron's application-data directory. Explicit cloud opt-in uses a separate initialized private personal GitHub data repository (existing or explicitly created in Settings → Cloud) for planning data, including projects whose code lives in Azure DevOps. It does not write task data into code repositories. Signing out does not delete tasks or revoke the shared GitHub CLI login. File separation is a convenience boundary, **not encryption or protection from another user of the same OS account**. Local offline access is intended for the last verified identity; account switching must verify the new identity online.

GitHub tokens stay with the official CLI; the renderer never receives them. The terminal's narrowly scoped bridge permits interactive shell input only after explicit start, under your OS permissions; it is not a command sandbox. Sign-in alone does not enable cloud transfer. Use **Settings → Cloud → verify dedicated repository → consent → Sync now**; pulls require confirmation and conflicting copies are not overwritten. Cloud snapshots preserve tasks/milestones but exclude device paths and terminal output. Private Git history is plaintext, not end-to-end encrypted; anyone with repository read access can read it, and disabling sync does not erase history. Real GitHub transfer between two local stores was verified with dummy data; two physical native devices remain unverified. See [cloud evidence](cloud-live-evidence.md).

## Running directly from source (developers / troubleshooting)

In the desktop app, **Sign in with GitHub** first verifies/reuses an existing CLI account. Only when the CLI reports no working login does it start the fixed official `gh auth login --hostname github.com --git-protocol https --web` flow in Terminal (macOS) or Windows PowerShell. Finish the terminal/browser prompts, then **Check sign-in** (verification only). Opening a terminal is **pending, not authenticated**. A failed check permits an explicit retry; it never automatically launches another login. Linux, missing CLI, or a denied native-terminal launch gives the manual command below. No shared `gh auth logout`, scope expansion, or token-returning bridge is used.

If workspace loading fails, **Import backup** remains available; **Export backup** and editing stay disabled. Choose an existing exported JSON backup (regular file, at most 8 MiB, valid v1 schema) and confirm the native restore dialog. For a corrupt primary, **both existing primary and rolling backup** are copied byte-for-byte into a uniquely created `accounts/<verified numeric ID>/recovery-<random>/` archive before atomic replacement. These archives are never rotated or deleted by RiftTask. Cancellation, validation/account-change errors and pre-replacement write failures preserve both originals. Keep the archives and original export; never delete corrupt files just to make loading succeed.

Use Node.js 24.15+ (24.x LTS) or 26+ and npm. Install the official [GitHub CLI](https://cli.github.com/) and sign in on **your own computer**:

```sh
gh auth login --hostname github.com --git-protocol https --web
```

Then, from a checkout of this public repository:

```sh
npm ci --ignore-scripts
npm run native:prepare
npm test
npm run build
npm start
```

`npm run dev` serves the renderer for UI work only; it is **not** a desktop sign-in or persistence substitute. The real desktop app loads the built local files.

## Source-build installation preview (not a released installer)

These scripts are a **source-build preview** with rerunnable Mac/Windows updates, not verified native installers. Native Windows/macOS installation and launch have **not** been exercised here. No signed/notarized release assets are being offered. Do not disable Gatekeeper, quarantine, Windows security controls, or PowerShell execution policy to run this preview.

Prerequisites on **your own computer**:

- Git in `PATH`. No `gh` or authentication is required for installation; the official CLI is a separate **app first-use identity** prerequisite.
- **Node 24.15+ within 24.x (recommended), or Node 26+**, with npm/npx. This conservative bootstrap baseline satisfies the current installed Vite (`^20.19.0 || >=22.12.0`), Vitest (`^22.12.0 || ^24.0.0 || >=26.0.0`) and jsdom (`^22.22.2 || ^24.15.0 || >=26.0.0`) engines. Node 20 alone is insufficient. Dependency/lockfile updates may change these requirements.
- Mac/Windows arm64 and x64: pinned `node-pty@1.1.0` ships N-API binaries. The installer uses `npm ci --ignore-scripts` to prevent compile fallbacks (including inherited `build_from_source`), explicitly runs only the pinned `electron@45.0.0` downloader if needed, checks exact-architecture native assets and runs an Electron PTY smoke before building/copying. It never changes shared npm configuration or blanket-approves scripts.
- Linux/development native builds: `make`, a C/C++ compiler, Python 3, and Electron desktop runtime libraries/display. Linux keeps Electron-native rebuilds because this package ships no Linux prebuild. Modified native dependencies may require your own development toolchain.
- `npm run native:rebuild` remains a compatibility alias for `native:prepare`: Mac/Windows validate prebuilds, Linux rebuilds. Packaging disables automatic rebuilding only for prebuilt platforms; native/helper assets remain unpacked, and macOS spawn-helper is made executable before signing.
- Network access for the public source, npm dependencies and Electron/build tooling; adequate build disk space. This is not an offline or dependency-free installer. Unset production-only npm settings so development/build dependencies are installed.

### Install on macOS or Linux

Run this command in Terminal:

```sh
bash -o pipefail -c 'curl -fsSL https://raw.githubusercontent.com/wisedev-pstach/RiftTask/main/scripts/install.sh | bash'
```

This executes downloaded code: run it only if you trust this repository and its current contents. The small `pipefail` wrapper makes a failed download return a failure instead of an empty successful Bash run. The script builds the current public `main` in its own temporary directory; it does not leave a source checkout in your working directory. This is a source build, not a prebuilt app or a pinned release.

Defaults: macOS `~/Applications/RiftTask.app`; Linux `~/.local/share/rifttask` with launcher `~/.local/bin/rifttask` (add that directory to your `PATH` yourself if needed). `--dest '/absolute/new/path'` means the **exact final application directory**, not a parent; on macOS it must end in `.app`.

### Install on Windows

Run in a normal PowerShell session:

```powershell
irm https://raw.githubusercontent.com/wisedev-pstach/RiftTask/main/scripts/install.ps1 | iex
```

`irm` downloads the script and `iex` executes it. Only run this if you trust the repository and its current contents. It builds public `main` in an owned temporary directory, not a persistent source checkout. Native-command failures throw and stop installation without exiting your PowerShell session. Keep existing security controls enabled; if organizational policy blocks the command or downloaded scripts, stop and consult your administrator rather than bypassing it.

Default: `%LOCALAPPDATA%\Programs\RiftTask`. `-Dest 'C:\absolute\new\path'` selects the exact final directory. After copying and checking `RiftTask.exe`, setup creates **one current-user Start Menu shortcut**, `RiftTask.lnk`, in `[Environment]::GetFolderPath('Programs')` (normally `%APPDATA%\Microsoft\Windows\Start Menu\Programs`). It uses the exact absolute executable as target and icon, the install directory as working directory, and no arguments. No administrator rights, all-users shortcuts, Desktop shortcuts or machine-wide registry registration are used. Open Start and search **RiftTask**; indexing can take time. This is **Start Menu discovery**, not Settings → Installed apps/uninstaller registration. The bootstrap never launches the app automatically.

An existing `RiftTask.lnk` is refreshed only if its canonical absolute target matches this exact installation (case-insensitive) and it has no arguments. Unrelated, malformed or reparse-point shortcuts are preserved and registration stops. Choosing a new app directory does not authorize replacing a shortcut to another install. A registration failure after copying reports that app files were kept, not a completed installation; use the repair below after resolving the reported conflict.

### Repair Windows Start Menu discovery without reinstalling

For an existing default installation, run in a normal PowerShell session:

```powershell
& ([scriptblock]::Create((irm 'https://raw.githubusercontent.com/wisedev-pstach/RiftTask/main/scripts/install.ps1'))) -RegisterOnly
```

For a custom existing installation, append `-Dest 'C:\absolute\existing\RiftTask'` to that command. Unlike plain `irm | iex`, the scriptblock invocation passes these parameters to the downloaded script. This command executes moving `main`; use it only after the updated script is published there and you trust its contents. From this checkout (or an inspected downloaded script), the equivalent is:

```powershell
& .\scripts\install.ps1 -RegisterOnly
# Custom existing installation:
& .\scripts\install.ps1 -RegisterOnly -Dest 'C:\absolute\existing\RiftTask'
```

Repair checks that `RiftTask.exe` exists **before** build-tool discovery. It does not need Git/Node/npm, download app dependencies, build, replace any app files, launch the app, upgrade, uninstall or touch app data. It only creates/safely refreshes that current-user shortcut. Do not combine `-RegisterOnly` with `-Check`, `-DryRun`, `-Source` or `-Ref`. If the shortcut belongs to another installation, inspect it manually; the script does not remove or retarget it.

**Menu bar:** current source removes Electron's default File/Edit/View/Window/Help bar on Windows/Linux, retaining the native title bar and minimize/maximize/close buttons and normal renderer keyboard input. macOS keeps its standard application menu. Discovery repair alone does **not** update an old executable or remove its old menu; test a build of the updated source for that change. Close RiftTask and rerun the installer to update a recognized app; discovery repair alone never replaces app files.

### Optional: download and inspect first

Instead of piping directly into a shell, download in a **new empty directory**, inspect the file, and only then run it if trusted. These commands still use moving `main`; inspection is not signature verification.

macOS/Linux:

```sh
curl -fsSL https://raw.githubusercontent.com/wisedev-pstach/RiftTask/main/scripts/install.sh -o install.sh
less ./install.sh
# After inspection, run separately:
bash ./install.sh
```

Windows (only where existing policy permits downloaded local scripts):

```powershell
Invoke-RestMethod https://raw.githubusercontent.com/wisedev-pstach/RiftTask/main/scripts/install.ps1 -OutFile install.ps1 -ErrorAction Stop
Get-Content .\install.ps1
# After inspection, run separately:
& .\install.ps1
```

For a tools/destination check without installation, run the inspected file with `bash ./install.sh --check` or `& .\install.ps1 -Check`. To select a genuinely new destination, use `bash ./install.sh --dest '/absolute/new/RiftTask.app'` (macOS) or `& .\install.ps1 -Dest 'C:\absolute\new\RiftTask'` (Windows).

### Advanced: build a reviewed commit

Optional, not required for quick setup. Supply a reviewed **full lowercase 40-character commit SHA** in place of the placeholder. In a new empty directory these recipes fetch the bootstrap from that revision and build that same source revision; unavailable or invalid pins fail closed. This is reproducible source selection, **not signed release provenance**. Inspect the downloaded script before executing it if you have not already reviewed that revision.

macOS/Linux:

```sh
ref='<reviewed full lowercase 40-character commit SHA>'
curl -fsSL "https://raw.githubusercontent.com/wisedev-pstach/RiftTask/$ref/scripts/install.sh" -o install.sh
# After a successful download and inspection:
bash ./install.sh --ref "$ref"
```

Windows:

```powershell
$Ref = '<reviewed full lowercase 40-character commit SHA>'
Invoke-RestMethod "https://raw.githubusercontent.com/wisedev-pstach/RiftTask/$Ref/scripts/install.ps1" -OutFile install.ps1 -ErrorAction Stop
# After a successful download and inspection, where existing policy permits:
& .\install.ps1 -Ref $Ref
```

The installer fetches, detaches, verifies and prints the exact source commit before running npm. Keep that SHA for reports. The simple quick-start commands intentionally track moving `main` instead.

### Preservation and limits

- **Mac/Windows:** rerunning the same command installs when absent and updates only a recognized RiftTask app. Recognition reads ASAR package name `rifttask`, main `desktop/main.cjs` and canonical app ID `dev.wisedev.rifttask` (`build.appId` in older archives, preserved `rifttask.appId` in new packages); macOS also requires the matching Info.plist bundle identifier/executable. A filename or management marker alone is never sufficient. Electron-builder strips `build` metadata: older archives with no canonical-ID field may instead prove identity through the exact macOS bundle identifier/executable or both Windows static PE `ProductName` and `FileDescription` equal to `RiftTask`; the old app is never executed. Missing/unreadable native metadata or any contradictory ASAR ID is refused. Keep refused apps and report the identity error rather than deleting files or editing metadata to force acceptance. Files, unrelated/empty directories, symlink/reparse ancestors, roots/home and source/build/temp or app-data overlaps are refused. Linux retains its existing new-install-only behavior. Windows `-RegisterOnly` remains shortcut-only.
- No application-data migration/deletion, credential changes, quarantine stripping or security bypass. Existing data remains in Electron's normal account-scoped application-data location; a new app directory is not a separate data profile.
- Mac/Windows clone/build/native verification/package/copy failures leave the previous app unchanged. Replacement is copied into invocation-owned staging beside the target, preserving framework symlink literals, validated, then published by native no-replace directory rename under an exclusive sibling lock. Identity/fingerprint are rechecked before moving the old app into a unique sibling backup. Publication and rollback refuse even a concurrently created empty target directory; neither overwrites it nor nests an app inside it. A failed promotion restores the old app only if the target is still absent; if rollback also fails, the error prints the exact backup and manual restore destination. macOS uses built-in `osascript`/JXA and `renamex_np(RENAME_EXCL)` (macOS 10.12+ and filesystem support required), with no compiler/Python dependency or unsafe fallback. Windows uses Node/libuv's native directory rename, which refuses existing destination directories. These operations protect late destination-name arrivals, not arbitrary hostile replacement of ancestor/source paths by another OS user. Close RiftTask before retrying a Windows executable-lock error. No process is forcibly stopped. Stale locks are not guessed or killed; inspect an interrupted invocation manually. Only current-invocation build/staging paths and its lock are cleaned. Linux copy failures can still leave a new partial install.
- **Disk space/backups:** allow space for the fresh source/dependencies/package, a full staged app and the previous app. Previous-app backups live in unique `.rifttask-backup-*` sibling directories, outside app data; their exact path is printed. Older backups are never pruned automatically. Keep them until you have verified the new app; any manual cleanup is your decision, not part of setup.
- `--check` / `--dry-run` and `-Check` / `-DryRun` do not clone, build, create directories/shortcuts, log in or alter app data. They fail on missing build tools (Git/Node/npm), unsupported Node/architecture or an unsafe destination—not missing `gh` or unavailable authentication. Existing-directory checks report an intended update candidate; ASAR identity verification is deferred until dependencies are ready, so check mode does not promise that an older app is recognizable. They inspect tools/destination, **not full compiler availability, network/source access, dependency downloads, app sign-in, signing or successful native launch**.
- Current evidence: [installer evidence](installer-evidence.md), [menu/discovery evidence](windows-discovery-evidence.md). Linux executable fixtures and simulated macOS path selection are **not** native macOS/Windows installation proof. Menu/discovery fixtures execute real PowerShell 7.4.6 on Linux with simulated Windows COM/build commands; they do not verify Windows Search indexing, native shortcut behavior, PowerShell 5.1 or native window chrome. Earlier installer evidence's unavailable-PowerShell note is historical.

## Verification

Core tests: `npm run test:core` (Node's built-in runner). Renderer tests: `npm run test:ui` (Vitest and Testing Library). Production renderer build: `npm run build`.

Native Windows/macOS behavior is only considered verified after execution on those operating systems; Linux unit/build success is not evidence that their installers work.

The owner performs native macOS/Windows testing using public `main`. No prebuilt release, signing/notarization, security bypass or native-platform success is implied by the source commands or browser screenshots. Implementation/test details: [functional evidence](functional-completion-evidence.md), [final scope](FINAL-SCOPE.md), [build state](BUILD-STATE.md).