# Manual cloud runtime evidence — 28 October 2026

## Delivered slice and boundaries

Wired `cloud-snapshot.cjs` through Electron main → service → trusted IPC/preload → React manual consent/status controls. No background sync, repository creation, issue import, auth scope changes, cloud-data repository access, or real cloud snapshot transfer was performed. **External two-device/GitHub Contents verification remains pending explicit authorization.** Mock success is not evidence of real cloud persistence.

New Promise bridge APIs:
- `cloudStatus()` → `{state:'off'|'ready', repository?}` (local config only).
- `cloudVerify('owner/name')` → sanitized verified repository metadata (no task transfer).
- `cloudEnable({repositoryId,consent:true})` → ready; only accepts the main-process pending selection for the same numeric account/generation.
- `cloudDisable()` → off; cancels outstanding runtime application via epoch.
- `cloudSync({})` → verified / conflict / download-required (with `pullSha`).
- `cloudSync({pullSha})` → re-read exact selected revision, require unchanged local base, rolling backup before restore, return restored workspace. Changed remote SHA asks again; both-side changes never accept this as an overwrite escape hatch.

Config: `accounts/<numeric-id>/cloud.json`, private atomic temp/rename, separate from workspace. Selected numeric repository/owner IDs and default branch pinned; privacy/ownership/identity rechecked at sync. Source numeric ID **1432181232** independently obtained by read-only metadata query `gh api --hostname github.com repos/wisedev-pstach/RiftTask --jq .id`; this was the only live GitHub command in this implementation pass. It accessed source metadata, not cloud task data. Source name and ID denied; current project URLs denied (case/trailing slash/.git normalized), org/public/fork/archive denied. Dedicated target root may contain only README/license/Git settings/snapshot files; unrelated files/directories block transfer.

Contents transport fixes host `github.com`, numeric repo endpoint and `rifttask-workspace.json`, pins branch, uses argv arrays and stdin JSON, 20-second timeout, combined 2 MiB stdout/stderr limit, no shell and sanitized failures. Read size is 512 KiB including envelope, with base64 metadata and Git blob SHA validation. Root listing must establish absence: **404 never initializes data**. Repository must already be initialized, e.g. with a README. Expected SHA on update; rejected writes re-read and stop/reconcile, never retry unconditionally. Exact readback required before acknowledgment. Already accepted network requests cannot be recalled by logout.

First sync conflicts if both sides contain different data, except byte-identical snapshot recognition. Empty device can offer an explicit confirmed pull. Base fingerprints omit only workspace `updatedAt` bookkeeping (empty stores generate a fresh timestamp on each load); task timestamps remain included. Initial timestamp-only differences on nonempty workspaces still conflict, not exact-copy recognition. Device paths never upload; restoring retains mappings by project ID.

## Actual vertical RED → GREEN cycles

Commands were run at each step, not reconstructed test output:

1. `node --test tests/cloud-runtime.test.cjs`: RED missing runtime module → GREEN 1 test, off/verification/explicit per-account consent.
2. Same command: RED `Missing expected rejection` for unsafe targets → GREEN 2 tests, repository and transfer policy.
3. Same: RED `ready` vs `verified` → GREEN 3 tests, upload/readback/base SHA/conflict. Intermediate genuine failure exposed fresh empty-workspace timestamps; fingerprint handling corrected.
4. Same: RED pull returned download-required after confirmation → GREEN 6 tests, restore+backup/path mapping and account stale response coverage.
5. `node --test tests/cloud-transport.test.cjs`: RED missing transport → GREEN stdin payload/expected SHA test. Next RED missing boundedExecute/read → GREEN 3 tests including real Node child-process stdin, timeout, output cap and sanitized stderr errors. No gh data command executed by these tests.
6. `node --test tests/service.test.cjs`: RED absent cloudStatus → GREEN 6 tests. `node --test tests/ipc.test.cjs`: RED preload lacked new exact method list → GREEN narrow bridge wiring.
7. `npm run test:ui -- --reporter=dot`: RED missing CloudPanel → GREEN 28 UI tests. Next RED missing Cloud persistence button → GREEN 29 UI tests, actual App integration.
8. Runtime regressions RED → GREEN: disable-during-read previously allowed a write; initial timestamp-only differences previously treated as identical; symlink configuration root previously created a directory before rejection; rejected optimistic write previously did not re-read; renamed source numeric ID previously accepted; enable response previously omitted selected target. Each fixed after observed failure.
9. React parent-save regression: `npx vitest run src/CloudPanel.test.jsx --reporter=dot` RED Sync now remained enabled → GREEN 2 panel tests, parent lock honored.
10. Dedicated transport root RED accepted package.json → GREEN rejection. Reconfiguration-during-sync RED accepted verification → serialized guards added, final rerun below.

Additional real scratch-file integration exercises service/trusted IPC, upload to **injected local fixture file**, restart, second independent device opt-in, explicit pull and fresh-store read. Not a network simulation represented as real cloud success.

## Browser check

Real headless Chromium `/opt/hermes/tools/chromium-1208/chrome-linux64/chrome` with Playwright, actual Vite renderer at loopback port 5198. Injected synthetic bridge and repository metadata, deliberately no verified cloud-success state. Consent button disabled before checkbox; manual Sync now shows conflict; zero page errors. Screenshots visibly banner **MOCK BROWSER UI ONLY — synthetic repository metadata; NO cloud transfer or authentication**:
- `artifacts/screenshots/cloud-manual-20261028/mock-consent.png` (visually inspected; readable, no clipping at 1440×1080).
- `artifacts/screenshots/cloud-manual-20261028/mock-conflict.png`.

Scratch runner: `/opt/data/cache/scratch/rifttask-cloud-browser-smoke.cjs`. Screenshots ignored, not source assets. Native Electron and Windows/macOS runtime not exercised.

## Final verification

Final `npm test`: **94 core/integration + 30 React tests passed**, zero failures/skips. `npm run build`, `node --check desktop/cloud-runtime.cjs`, `node --check desktop/cloud-transport.cjs`, and `git diff --check` passed. Browser consent/conflict smoke passed with zero page errors. No remote cloud transfer, commit, push, merge, release or scope change.

## Parent review regressions and fixes

Independent review found two blockers, both reproduced before production fixes:

- `node --test --test-name-pattern='asynchronous policy' tests/cloud-runtime.test.cjs`: RED exit 1, `Missing expected rejection`. A linked-project lookup changed the workspace URL to the chosen cloud repository during asynchronous validation; the original implementation captured its transfer baseline afterwards. GREEN 1/1 after policy and transfer use the same pre-validation workspace projection/fingerprint, freshly compared before any snapshot read/write.
- `node --test --test-name-pattern='corrupt configuration' tests/cloud-runtime.test.cjs`: RED exit 1, `Missing expected rejection`. Persisted `enabled:'false'` was treated as consent. GREEN after strict version-1 schema on read/save: boolean enablement, numeric account/repository/owner binding, personal/private/non-fork/non-archived metadata, valid name/branch and paired valid base hash/SHA. Disable resets corrupt config without reading it or transferring anything.
- Parent also observed a failing renamed-project identity regression before resolving every linked GitHub URL to a numeric ID; matching aliases now reject, unavailable metadata blocks safely, distinct IDs permit sync.
- `npx vitest run src/CloudPanel.test.jsx`: RED 2 failed / 2 passed, because deferred initial status replaced newly enabled UI and corrupt configuration had no visible reset action. GREEN 4/4 after revision-fencing initial status and adding **Reset local cloud settings**. Disabled actions are guarded in handlers too.
- Parent full rerun: `npm test` **98 core/integration + 32 UI tests PASS**, `npm run build` PASS, `git diff --check` clean. No live cloud transfer. Independent re-review passed with no security concerns or logic errors; targeted cloud suites passed 22/22. Nonblocking follow-ups: expand configuration-schema table coverage and deferred write/readback/UI SHA-confirmation regressions. No live cloud or native-platform acceptance is implied.

## Remaining / independent review focus

- Real GitHub Contents endpoint/permission behavior, cross-device use and platform subprocess packaging remain unverified; require authorized synthetic-only live test before claiming end-to-end remote acceptance.
- Conflict resolution is deliberately stop-only: export a local backup, preserve both sides, no force-push/force-pull/automatic merge UX.
- Parent closed the renamed/aliased project URL gap after a failing regression: each linked GitHub project is resolved to its numeric repository ID during verification and pre-transfer validation; a matching cloud target is rejected. Unresolvable linked identity blocks transfer with a sanitized error. Distinct linked repositories still permit sync. This can require additional metadata reads; private/inaccessible links may block cloud until resolvable.
- Local files and private Git history are plaintext; rolling backup is not a permanent archive. No OS-adversary/file-race security boundary is claimed. Config uses atomic rename but not a separate crash-durable fsync protocol.
- Independent security review belongs to parent; no commits/push/merge/release by worker.
