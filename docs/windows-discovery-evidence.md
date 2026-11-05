# Native menu and Windows discovery evidence

Branch: `fix/windows-app-discovery`. These are source changes, not a published installer or verified native Windows release.

## Delivered

- Windows/Linux: clear Electron's default application menu and remove/hide the menu on every created/recreated window. Keep the native caption/window controls, renderer keyboard input, sandbox and existing IPC restrictions. macOS retains its normal application menu.
- Windows runtime identity: `dev.wisedev.rifttask`, matching the packaging app ID.
- Source installation: after copying and validating `RiftTask.exe`, create one current-user `RiftTask.lnk` under `[Environment]::GetFolderPath('Programs')`, with an absolute APPDATA fallback. Explicit absolute executable target/icon, install working directory, description and empty arguments; reopen the saved shortcut and verify those fields before success.
- Existing-install repair: `-RegisterOnly`, optionally `-Dest`, validates the executable before any build-tool/architecture checks. No Git/Node/npm/build, app execution, app-file replacement, data changes, upgrade, all-users/Desktop shortcuts or Installed apps/uninstaller registry entry.
- Preserve an existing shortcut unless its canonical absolute target is this same installation (case-insensitive) with empty arguments. Refuse unrelated, argument-bearing, relative-target, directory, corrupt or reparse-point links. Normal installation still refuses existing app destinations.
- Post-copy registration failures preserve installed files and report partial success, not installation complete. A missing copied executable stops before COM and does not claim the app is installed.

## TDD / executed results

Nine observed RED → GREEN cycles, each with an expected one-test failure before its passing implementation: menu removal, RegisterOnly binding/no-tool repair, safe matching-link refresh, conflicting Check rejection, saved-link readback, automatic fresh-install registration, honest COM-failure reporting, copied-executable validation, and separately isolated Windows app identity. Additional safety/regression cases cover literal/metacharacter paths, default repair, missing executables, unchanged unrelated links/files, Check side effects, case/canonical matching and the literal SETUP repair recipe.

Final execution:

- Core: **218 tests; 212 passed, 0 failed, 6 skipped**. Skips are the optional real icon archive and five platform PTY archive integrations; packaging configuration/native artifacts were not changed.
- Renderer: **56 passed across 6 files**.
- Production renderer build: **passed**, with the existing >500 kB chunk-size warning.
- `git diff --check`: passed.

Commands from the repository root (on this verification host):

```sh
PATH=/opt/data/cache/scratch/rifttask-pwsh:$PATH \
  DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1 \
  RIFT_PWSH=/opt/data/cache/scratch/rifttask-pwsh/pwsh npm run test:core
npm run test:ui
npm run build
```

The host initially had no PowerShell. A portable PowerShell 7.4.6 Linux archive (68.3 MiB download, under the 100 MiB cap) was unpacked only under scratch. Its initial launch failed because ICU was unavailable; invariant-globalization mode allowed the real PowerShell parser and script runtime to execute. `RIFT_PWSH` selects a runtime for the new test harness; add its directory to PATH for the pre-existing parser test. No PowerShell distribution is shipped with RiftTask.

`tests/windows-registration.test.cjs` executes the real installer through `tests/fixtures/windows-installer.ps1` on Linux, using real literal-path files and mocked Windows COM/build commands. Fixture executables are non-executable text sentinels. Build tools are fail-fast traps during repair. The exact documented repair command is extracted from SETUP and executed with only its download stubbed to the local script; both scriptblock invocation scopes bind `-RegisterOnly` correctly. The fixture refuses non-Linux execution so it cannot write a real native Start Menu. `tests/ipc.test.cjs` executes the real Electron entrypoint against behavior-recording Electron doubles for Windows, Linux and macOS, including recreated windows.

## Copy-ready repair and native handoff

From a checkout of this branch, in a normal Windows PowerShell session:

```powershell
& .\scripts\install.ps1 -RegisterOnly
# Or an existing custom installation:
& .\scripts\install.ps1 -RegisterOnly -Dest 'C:\absolute\existing\RiftTask'
```

After the updated script is published to `main`, the downloaded-script repair is:

```powershell
& ([scriptblock]::Create((irm 'https://raw.githubusercontent.com/wisedev-pstach/RiftTask/main/scripts/install.ps1'))) -RegisterOnly
```

Append `-Dest 'C:\absolute\existing\RiftTask'` for a custom installation. Run downloaded code only if trusted; do not bypass execution policy or OS security controls.

On Windows, check the printed shortcut path and Properties (target, no arguments, working directory and icon). Open Start → All apps → RiftTask, then search for RiftTask after indexing. Repeating repair for the same installation should succeed. A shortcut belonging to another installation must be preserved with a refusal message. Do not remove the old app/data to bypass a conflict. Start Menu discovery does not imply Settings → Installed apps registration.

For the updated menu, use supported Node/Git/npm and this branch's source:

```powershell
npm ci --ignore-scripts
npm run native:prepare
npm test
npm run build
npm start
```

Check no File/Edit/View/Window/Help bar, including after Alt; native minimize/maximize/close still work; Ctrl+C/V/X/A/Z in a task text field and the explicitly started terminal still work. Keep test planning data dummy-only. For a fresh installation test, `& .\scripts\install.ps1 -Dest 'C:\absolute\new\RiftTask'` builds public `main`, so wait until these changes are there; it never launches the app automatically. Registration-only repair does not update an old binary or remove its old menu.

## Limits

No native Windows COM, Windows Search indexing, Windows PowerShell 5.1, native title-bar/keyboard automation, installed executable launch, macOS menu run or signing verification was performed. The Linux PowerShell fixtures are runtime evidence for control flow/path safety, not native Windows acceptance. No screenshot is supplied: renderer layout/CSS did not change, and this host cannot display Windows native chrome. No commit or push was performed.
