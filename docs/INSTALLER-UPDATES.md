# Rerunnable installer updates

The user explicitly requested that the existing macOS curl and Windows irm commands update an already-installed RiftTask instead of refusing its destination.

## Delivery contract
- Same command installs when absent and updates only a recognized RiftTask application when present.
- Recognize earlier installations without a management marker through exact ASAR name/main plus canonical IDs or native legacy identity: macOS bundle ID/executable; Windows static PE ProductName and FileDescription both `RiftTask`. Contradictory ASAR IDs always reject; filenames/management markers alone never prove ownership. Native Windows qualification of real older binaries remains required.
- Require the app closed; never forcibly terminate user processes.
- Build and verify the replacement first. Stage beside the destination, retain the old app as a rollback backup, and restore it if promotion fails.
- Preserve task data, account identity, GitHub CLI credentials, cloud configuration and source checkouts. No task-data access or migration is authorized.
- Refuse unrelated folders/files/symlinks/reparse targets and unsafe path overlaps; retain all prior denied-cleanup restrictions.
- Keep previous-app backups and print their exact paths. Do not silently prune older installations/history; disclose the disk-space requirement.
- Check/dry-run remain side-effect-free. Windows Start-menu registration and no-build registration repair remain supported.
- Verify actual filesystem failure paths and repeated installation/update fixtures on both script paths. PowerShell-on-Linux fixtures are not native Windows/macOS acceptance.

## Directory publication provider contract

`renameExclusiveSync(from, to, hooks = {})` accepts a real directory source and an exact same-volume destination. Old-app backup, stage publication, and rollback all use it (test seam: `io.renameExclusiveSync`). A destination entry must never be replaced or treated as a container. There is no production check-then-rename/BSD `mv -n` fallback.

- **macOS:** built-in `/usr/bin/osascript -l JavaScript -e <fixed script> -- <from> <to>` binds `renamex_np` as `int(string, string, unsigned int)` through JXA. Only argv carries paths, including quotes/metacharacters/Unicode; no path is interpolated into executable code. `RENAME_EXCL = 0x00000004` is from [Apple's official header](https://github.com/apple-oss-distributions/xnu/blob/main/bsd/sys/stdio.h). [Apple's man page](https://github.com/apple-oss-distributions/xnu/blob/main/bsd/man/man2/rename.2) specifies `EEXIST` for existing destinations and filesystem support requirements. [Apple's JXA function-binding/types documentation](https://developer.apple.com/library/archive/releasenotes/InterapplicationCommunication/RN-JavaScriptForAutomation/Articles/OSX10-10.html) specifies `ObjC.bindFunction` and `string`/`unsigned int` type names. Native API requires macOS 10.12+. Missing bridge/API/filesystem support fails closed, without Python, Xcode or compiler installation. Spawn is bounded to 10 seconds / 8192 bytes with hidden Windows console option and checked status/output.
- **Windows:** directory-only Node `fs.renameSync` uses [libuv `fs__rename` / `MoveFileExW(MOVEFILE_REPLACE_EXISTING)`](https://github.com/libuv/libuv/blob/v1.x/src/win/fs.c). [Microsoft's authoritative contract](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-movefileexw) explicitly reports an error if the new name is an existing directory, even with `MOVEFILE_REPLACE_EXISTING`. This does **not** make Node file renames exclusive; non-directory sources are rejected. There is no child-process/compiler dependency for this operation.
- **Linux simulation only:** explicit `RIFTTASK_TEST_GNU_MV=1` (or the unit-test `linuxFixture` hook) enables `/bin/mv --no-copy --no-clobber --no-target-directory -- from to`. The source must actually disappear: GNU `-n` can return zero when it skips. `-T` prevents nesting; `--no-copy` forbids cross-device copy/delete. The tested host has GNU coreutils 9.7 and supports native `renameat2(RENAME_NOREPLACE)`. GNU/gnulib can fall back nonatomically on unsupported kernels/filesystems, so this fixture is **not** a supported Linux updater or a portable concurrency guarantee. Unopted-in/other hosts refuse. Product Linux installer behavior remains unchanged.

`isRunning(platform, hooks = {})` checks only process presence; it never terminates anything. Both process probes have the same 10-second / 8192-byte / hidden-console bounds as static PE inspection and fail closed on timeout/output/status errors.

Framework links are copied with `verbatimSymlinks:true`, never dereferenced or stripped. Executable, ASAR, plist, bundle and destination identity paths still reject symlinks.

Concurrency scope: protects a late arrival at an exact destination name, including empty directories. This is not a hostile-OS-user boundary against arbitrary source or ancestor replacement. Existing locks/backups stay preserved; owned staging/lock cleanup remains unchanged. Native Mac/Windows execution is still required for platform acceptance; bridge/Windows hook tests on Linux are not native proof.
