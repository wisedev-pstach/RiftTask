# Backup import evidence — 2026-10-25

## Delivered slice
- Existing explicit renderer restore consent now reaches trusted zero-argument IPC, native single-file JSON dialog, main service and account-scoped store. Cancellation returns null.
- Same-account verification before dialog, after selection, and immediately before synchronous store save. No renderer paths/accounts accepted.
- Source must be a regular file (symlinks rejected); descriptor fstat, nonblocking/no-follow flags where supported, and at most 8 MiB + 1 bytes read protect against oversized/growing input. Read/parse errors are sanitized. Only version 1 is supported; unknown versions are rejected, not migrated.
- Complete schema/reference validation precedes replacement. Existing store.save writes the previous valid workspace into workspace.json.bak before atomic primary replacement. A fresh store reads restored data. Source file is unchanged.
- Backup is the normal rolling single-generation .bak, not a permanent restore-history archive. Subsequent saves rotate it. Export separately first if long-term retention matters.
- Corrupt current persistence without a recoverable backup deliberately blocks import rather than discarding originals. Existing store recovery behavior applies if a valid .bak exists; importing is not yet a corrupt-data salvage UI.

## Actual RED → GREEN
1. `node --test tests/backup-import.test.cjs`: first restore test failed because importBackup was missing. Minimal service restore passed (1/1).
2. Added cancellation: failed on null path; early null return passed (2/2).
3. Added account-change test: missing expected rejection; two rechecks passed (3/3).
4. Added malformed/version/reference/oversize/type/source-error matrix: failed on raw JSON SyntaxError; bounded reader and sanitized validation passed (4/4).
5. `node --test --test-name-pattern='import uses' tests/ipc.test.cjs`: failed with importBackup not yet available. Added basic-method dispatch and injected native-open callback; focused service/IPC run passed (13/13).
6. Added preservation characterization tests for existing store behavior: backup replacement failure and corrupt primary leave primary unchanged. No production change was needed for these existing safeguards.

## Final actual verification
- Baseline `npm test`: 58 core/integration + 15 renderer passed.
- Final `npm test`: **64 core/integration + 15 renderer passed**, zero failures/skips.
- `npm run build`: passed, Vite production assets generated.
- `node --check desktop/service.cjs`, `desktop/main.cjs`, `desktop/ipc.cjs`: passed.
- `git diff --check`: passed.
- Independent read-only reviewer returned passed=true, no security/logic blockers. Suggested optional read-growth/fault injection and store failure tests; store preservation tests added afterward and full suite rerun. Growth/short-read/close fault injection remains optional additional coverage, not claimed executed.
- Real scratch filesystem tests verify restored primary, previous-workspace .bak, fresh-store read and unchanged input. No actual user app data or auth state modified.
- Native Electron dialogs injected in tests; Windows/macOS GUI/runtime execution NOT tested. No installer, release or CI success claimed.
- Preflight: remote main matched d0f72a91bca9771e7a6f099d8426c069fc7d5bc8, repo PRIVATE, clean worktree and 18 GB available. Exact new private commit/push readback appears in run delivery.
