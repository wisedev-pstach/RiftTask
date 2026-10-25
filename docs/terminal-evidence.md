# Native terminal slice — 2026-10-25

## Scope and behavior
- Existing renderer Open terminal action now reaches a real main-process service rather than a deferred-method error.
- Trusted IPC accepts one project ID only; the authenticated, bound account's persisted workspace supplies the local path. Disconnected/switched accounts, missing projects, extra command arguments and foreign frames reject.
- Validates absolute paths without NUL/CR/LF and requires an existing directory. No renderer path or shell command is executed.
- macOS uses `/usr/bin/open -a Terminal -- <directory>` with opaque arguments, waits for the launcher and limits it to 10 seconds. Windows uses system Windows PowerShell `-NoLogo -NoProfile -NoExit` with cwd, no command string. Linux uses `/usr/bin/x-terminal-emulator` with cwd. All use `shell:false`, ignored stdio and visible native consoles.
- Linux/Windows observe early errors/nonzero exit for 300 ms before detaching an interactive process. A successful client handoff can exit zero immediately. Acknowledgment means startup accepted, not proof a visible terminal window appeared; failures after the startup window cannot be reported by the completed call.
- Terminal opening is an explicit user action; it does not run project scripts or fetch anything. Interactive shells may still load their normal user configuration (Windows PowerShell profile loading is explicitly disabled).

## RED → GREEN evidence
Command for each cycle: `node --test tests/native-terminal.test.cjs`.
1. Account-scoped IPC behavior: RED 0/1, expected `openTerminal is not yet available`; GREEN 1/1 after service/IPC wiring with injected launcher.
2. Platform argument behavior: RED 1/2, missing terminal helper; GREEN 2/2 after implementation.
3. Default service wiring/path rejection: RED 2/3, missing default launcher (`launchTerminal is not a function`); GREEN 3/3 after default integration and directory validation.
4. Sanitized launch failures: RED 3/4, subprocess detail `sensitive stderr` exposed; GREEN 4/4 after actionable error mapping.
5. Independent review found Linux/Windows could acknowledge an immediately failed process. Expanded nonzero-exit cases: RED 3/4, `Missing expected rejection`; GREEN 4/4 after early-exit observation.
6. Bounded macOS launcher: RED 3/4, expected timeout 10000, got undefined; GREEN after spawn timeout was added.
7. Added an extra regression test exercising successful interactive detachment rather than waiting for the terminal lifetime. Final targeted run: 5/5 passed.

## Actual verification
- Clean baseline `npm test`: 34 core + 15 renderer tests passed.
- Final `npm test`: **39 core + 15 renderer tests passed**, zero failures/skips.
- Final `npm run build`: Vite production build passed (16 modules).
- `node --check desktop/terminal.cjs`, `desktop/service.cjs`, `desktop/ipc.cjs`: passed.
- `git diff --check`: passed.
- Independent read-only review requested changes for immediate-exit handling; follow-up review approved after reproducing/fixing it and inspecting startup/error/account boundaries.
- GitHub repository fresh visibility lookup: PRIVATE. Commit/push remote SHA readback is recorded in the run delivery.
- Disk check: 18 GB available on /opt/data.

## Limits
All native process launch tests inject subprocess events while using real scratch directories. No native terminal GUI was launched or verified. Windows/macOS file-system and terminal behavior still need native runners; this Linux host lacks GTK for Electron smoke. A proposed extra inline-node environment probe was denied by scheduled command approval policy and was not retried or treated as evidence. No installer, release, CI workflow, auth mutation or external provider task import was performed.
