# Backup export — 2026-10-25

## Scope
Completed the existing Export backup button → trusted zero-argument IPC → native save dialog → verified active-account disk workspace → validated version-1 JSON file. This is export only, not import/restore. Login terminal onboarding remains a separate pending slice; export was selected as a bounded independent feature.

Exports contain schema-projected workspace data, not account identity or credentials. They are plaintext and may contain task notes and local paths; store them privately. Exclusive creation (`wx`, mode 0600 on POSIX) refuses existing destinations, including symlinks and internal account files. Choose a new filename even if the OS dialog offers overwrite confirmation. No renderer-supplied destination or account is accepted. Cancellation returns false and does not claim success. Account checks occur before dialog, after dialog and after loading, before synchronous file writing. Write/fsync/close errors reject; cleanup attempts are guarded. If cleanup cannot remove the incomplete destination, a safe error explicitly warns about it. Abrupt process/system termination may still leave an incomplete export; import must validate all input.

## Actual RED/GREEN observations
- Baseline `npm test`: 50 core/integration + 15 renderer passed.
- `node --test tests/backup-export.test.cjs`: first test failed because `service.exportBackup` was absent; after implementation it passed, writing a real scratch JSON file and loading it through a fresh store under a different numeric account.
- `node --test --test-name-pattern='export backup uses' tests/ipc.test.cjs`: failed with `exportBackup is not yet available`; main-process native dialog and IPC wiring made it pass. The test exercises real service/store/export with injected Electron dialog, including cancellation and sender/arity rejection.
- Account change during workspace load: observed `Missing expected rejection`; added post-load identity recheck, reran green.
- Additional guard coverage: disconnected user, canceled dialog, existing regular file, symlink, internal workspace, account change during dialog, invalid workspace, safe unwritable-destination error. These verify existing safeguards, not separate new behavior claims.
- Independent review found raw close/unlink errors could bypass error sanitization. Added fault injection for write, fsync, close and unlink using a VM-loaded real service and substituted filesystem only (real scratch filesystem tests retained). `node --test --test-name-pattern='sanitizes' tests/backup-export.test.cjs` failed exposing `/private/secret/backup.json`; guarded cleanup and close handling made all cases green.

## Final execution
- `node --test tests/backup-export.test.cjs`: 7 passed, 0 failed/skipped.
- `npm test`: **58 core/integration + 15 renderer passed**, 0 failures/skips. Existing renderer backup button/restore-consent tests remain green; no renderer change in this pass.
- `npm run build`: Vite production build passed (16 transformed modules).
- `node --check desktop/service.cjs`, `desktop/main.cjs`, `desktop/ipc.cjs`: passed.
- `git diff --check`: passed.
- Independent follow-up review: passed, no security concerns/logic errors; reviewer separately ran 16 focused export/IPC tests successfully. Nonblocking suggestion: strengthen cleanup-call/message assertions.
- Self/security review: no credentials, new shell execution, network calls or provider imports. Native paths come only from Electron dialog; schema validation and exclusive writes retain originals.
- `gh repo view wisedev-pstach/RiftTask --json visibility`: PRIVATE. Remote commit readback performed after private push; see delivery for exact SHA.
- Disk at start: 18 GB free.

## Not verified / remaining
Electron save dialog is injected, not native GUI tested. POSIX permissions do not prove Windows ACL behavior. Windows/macOS runtime verification, GTK-dependent Electron smoke and CI workflow permission remain unresolved. Import backup is still explicitly unavailable; next implement bounded file read + schema/version validation + safe current-account backup before replacement, preserving originals on invalid input/cancellation/account switching. Only version 1 is currently supported: reject unknown versions without guessing or destructive migration. Native login onboarding, authenticated installers and packaging remain unfinished; no release or functional installer claim.
