# RiftTask v0.1 — frozen scope and acceptance

Finalization means implementing the existing request, not adding features. This is a functional source-build preview, not a completed signed release. The owner will perform manual native testing; those checks are not a prerequisite to handing over the completed implementation. Source publication remains subject to parent review.

## Existing feature set

- Categories → project tiles → manually maintained tasks; Backlog/In progress/Done, priorities, due dates, notes, Today/search/list/board. Legacy `next` migrates to backlog.
- Project milestone labels, task assignment and completion counts. Label deletion is not delivered.
- Verified numeric GitHub identity, local account-separated persistence, offline resume and app-local disconnect. Sign in reuses a working official CLI account or initiates fixed `gh auth login --hostname github.com --git-protocol https --web` in macOS Terminal / Windows PowerShell. Linux/manual fallback is actionable. A launched terminal is pending, never authenticated; Check sign-in only verifies, with explicit retry after failure. No shared CLI logout, renderer commands or returned tokens.
- GitHub/Azure DevOps repository links, local directory selection, explicit local Git status. No provider issue/task imports, build/artifact upload or automatic project commands.
- Explicit-start bottom-docked per-project PTY sessions retained while navigating tabs/projects; stopped/invalidated on account/path/lifecycle changes. Full OS-user shell, not a sandbox; terminal output is not cloud data.
- Local backup export/import and rolling safety copy. Load-error UI permits import of a bounded, schema-validated exported backup, with default-cancel native confirmation. For corrupt primary, both existing originals are copied unchanged into a uniquely owned account-derived recovery archive before atomic restore; cancellation, validation/identity-generation failures and archive/write failure preserve original bytes. Archives are never rotated/deleted by the app. No silent empty-workspace seeding.
- Optional **manual** cloud sync to a separate initialized personal private GitHub data repository. Categories/projects/tasks/milestones sync; device paths stay local. Confirmed downloads, exact readback and expected-SHA writes; conflicts stop instead of merge/overwrite. No automatic/background sync or E2EE. Private Git history is readable by repository-authorized credentials and retains previous content.

## Evidence already available

Core/renderer automated tests; real scratch filesystem/Git/native Linux PTY checks; browser UI checks with explicitly substituted bridges; real GitHub transfer between two independent local stores and fresh Node process using dummy data only. These are different evidence levels, not interchangeable. See `cloud-live-evidence.md`, `milestones-evidence.md`, `pty-evidence.md`, `pty-disconnect-evidence.md`, and `installer-evidence.md`.

## Release acceptance still open

1. Owner's actual macOS AND Windows source-build/package/install/launch. Authenticated one-command source bootstraps are implemented, with full-SHA capture/fetch/detached-checkout verification and no overwrite/security bypass. They are not prebuilt release download installers; no signed/notarized binaries or verified one-command release install exists.
2. On each native OS: identity/CLI discovery, project/task/milestone CRUD, account restart/isolation, directory/open-link/native backup dialogs, retained PTY input/resize/navigation/cleanup, and opt-in cloud with synthetic data.
3. Two physical devices exchanging cloud updates/conflicts safely. Existing real-cloud evidence uses local processes/stores, not physical devices.
4. Native build CI and artifact provenance/checksums. Existing credential lacks workflow scope; do not expand it or bypass denial. No remote CI success is claimed.
5. Review and explicitly authorized merge/release after acceptance. Keep private draft PR #1 draft until gates are satisfied.

Actual host blockers independently checked: `libgtk-3.so.0` missing from Electron and unpacked app; no DISPLAY/WAYLAND_DISPLAY or Xvfb/Xorg/weston. Run-as-Node also exits 127 for GTK. PowerShell is unavailable; its installer assertions are source-contract checks, not native proof. Do not silently install long-running services or weaken platform security to remove these gates.

## First native test handoff

Use a fresh OS test account if RiftTask has existing real tasks. A new checkout/app directory does not isolate its normal userData. Prerequisites and source-build-preview commands are maintained in `../README.md`. Select `feat/cloud-persistence`, never default main. Existing application/launcher destinations are deliberately refused; do not delete old app/data to satisfy a preview.

In a fresh empty app, verify your CLI identity. Use dummy category/project/task/milestone data. For cloud download use the already authorized synthetic `wisedev-pstach/RiftTask-Cloud-Test` repository (ID 1438071650), review plaintext/history consent and explicitly confirm pull. Never upload real user tasks during acceptance or use project/source repos as cloud targets. Record OS/architecture, exact feature commit, each check result and errors; stop rather than invent success.
