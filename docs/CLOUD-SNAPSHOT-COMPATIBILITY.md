# Cloud snapshot compatibility (0.1.1)

## Cause and evidence

The main baseline for this fix is `d778b70`. Its workspace validator reconstructs projects and tasks without the newer optional `project.icon` and `task.progress` fields. Cloud projection intentionally compares the reconstructed workspace against its input with strict deep equality. A valid newer snapshot therefore becomes `Unsupported cloud workspace` internally and `Invalid cloud snapshot` at the restore boundary. This is a schema compatibility failure, not evidence of corrupt user data.

A synthetic, exact-envelope differential executed the baseline modules and fixed modules in the same JavaScript realm:

| Synthetic version-1 input | Baseline d778b70 | Fixed |
| --- | --- | --- |
| Legacy fields only | accepted | accepted |
| Project icon only | Invalid cloud snapshot | accepted without field loss |
| Task progress only | Invalid cloud snapshot | accepted without field loss |
| Both optional fields | Invalid cloud snapshot | accepted without field loss |

The installed user's precise build has not been identified; several builds report 0.1.0. This demonstrates the failure mechanism without claiming to have inspected that installation or its snapshot.

Category collapse in the feature branch is a renderer preference, not a canonical workspace field. No category schema field was invented. Unknown category fields, including `collapsed`, remain rejected at the cloud boundary.

## Narrow backport

Backported only the existing feature-branch core validation, `desktop/project-icons.json`, and cloud attachment projection/reconciliation. No feature UI, new IPC, styling, collapse UI or progress editor is included. Functional UI and appearance are unchanged; the existing task editor preserves additional validated fields.

- Optional icons use the existing eight-key manifest allowlist. The manifest is covered by existing packaging inclusion `desktop/**/*`.
- Progress entries allow only `id`, `createdAt`, `body`, `links`, `images`, `imageCount`; images allow only `id`, `name`, `mime`, `dataUrl`.
- Existing limits are retained: 100 entries/task, 4000 body characters, 10 HTTP(S) links/entry without credentials or unsafe whitespace/control/backslash syntax, 3 bounded raster attachments/entry, 256 KiB decoded/image. Raster checks are signature checks from the feature implementation, not full image decoding.
- Device project paths and attachment bytes never enter cloud projection. Attachment counts remain, and redaction happens before the 512 KiB cloud limit check. Local workspace validation still enforces its 8 MiB bound first.
- Restore preserves this device's project paths by project ID and local attachments only by matching project, task and entry IDs. Counts remain at least the retained local image count. Restore is revalidated.
- Strict positive safe-integer account/repository scope, envelope version, canonical equality, unknown-field rejection and cloud wire-size limits remain unchanged. No permissive unknown-JSON copying was added.
- Root package and root lock metadata are 0.1.1; dependency versions are unchanged.

## Installer handoff / migration

This is an unreleased source fix. Existing normal installations will not change merely because this branch exists. Review and build/release 0.1.1 through the normal authorized workflow, then install the updated application over the existing installation. No merge, push, official release or installer publication was performed here.

No schema-version conversion or cloud rewrite is required for these known optional fields. The fixed application reads both legacy and newer version-1 snapshots and preserves known progress/icon metadata through ordinary local saves and cloud round trips. This does not add controls to display/edit that metadata. Unknown future fields remain rejected rather than silently uploaded without them.

Do not advise deleting/resetting cloud data or removing progress/icon fields as a repair. Before an actual update or sync, follow the normal backup/review workflow. Avoid saving newer local workspaces using the old client: the baseline local validator can strip fields it does not understand. This patch cannot recover metadata that an old client already discarded. Inline images remain device-only and cannot be recovered from cloud counts on a different device.

## Parent verification and independent review

The parent independently repeated `npm test` and the production build: **247 Node passes / 21 platform skips**, **66 UI passes**, and build success. A second complete Node run with the existing PowerShell runtime enabled passed **261 tests with 7 platform/integration skips and zero failures** (`parent-pwsh-core.log`); these installer/COM fixtures are not native Windows acceptance. Read-only independent review `deleg_7bd2ea6e` found no security or logic blockers and independently passed 11 cloud tests. The `node_modules` symlink is excluded from source publication.

## Verification and safety

All fixtures are synthetic. Real account workspaces, snapshots, config, auth and provider state were not read or changed. Tests create isolated temporary store directories under `TMPDIR` and remove only those test directories. There were no provider writes, repositories created, schedules, real-account syncs or `.local` cleanup.

Commands ran serially with CPU affinity 0, using an existing `node_modules` tree through a worktree-local symlink, with no package installation:

```sh
taskset -c 0 node --test tests/cloud-compatibility.test.cjs tests/cloud-snapshot.test.cjs
taskset -c 0 ./node_modules/.bin/vitest run src/CloudCompatibility.test.jsx
taskset -c 0 npm test
taskset -c 0 npm run build
```

Results:

- Initial regression RED: 1 failure, exact `Invalid cloud snapshot` from baseline main.
- Attachment RED: unredacted local images exceeded the cloud limit before the cloud backport.
- Final focused cloud tests: 12 passed, no failures/skips.
- Focused renderer test: 1 passed; ordinary edit and status transition preserve progress/links/icon through real core validation and cloud preparation.
- Full Node suite: 268 tests, 247 passed, 21 platform/integration skips, 0 failures.
- Full renderer suite: 8 files, 66 tests passed.
- Production build passed; existing bundle-size warning (chunk over 500 kB) remains.
- `git diff HEAD --check` passed.

Evidence is stored outside the repository at `/opt/data/output/rifttask/cloud-snapshot-compatibility/`: `red.log`, `red-images-version.log`, `green-schema.log`, `green-images.log` (intermediate run before version bump), `green.log`, `focused-ui.log`, `npm-test.log`, `build.log`, `differential.cjs`, `differential.log`.

Not verified here: actual installed-app version, actual account snapshot, live provider transfer, native Windows/macOS installer execution, or official release artifacts. Platform-gated skips remain visible in `npm-test.log`. Do not include the local `node_modules` symlink in a commit.
