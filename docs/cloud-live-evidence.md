# Real GitHub manual cloud verification — 29 October 2026

## Outcome and scope

**PASS: real remote storage via production `cloud-runtime.cjs`, `cloud-transport.cjs`, and account `store.cjs`, using two independent scratch store/config roots.** This is not two physical devices or native Electron acceptance. No application appearance changed; this backend-only verification has no new UI screenshot. Prior browser screenshots remain explicitly mock/browser evidence, not live-transfer evidence.

Authorized one-off after the 28 October cutoff; no recurring work enabled. Created exactly `https://github.com/wisedev-pstach/RiftTask-Cloud-Test`, numeric repository ID **1438071650**, owner `wisedev-pstach`, numeric account **111281468**, branch `main`. Read-back metadata confirmed personal/private/nonfork/nonarchived both before and after transfer. Exact lookup returned 404; filtered accessible-repository metadata search returned no matching repository before creation. Initialization used a README and explicit private/auto-init settings. No pre-existing task repository contents were read.

Only DUMMY category/project/task/milestone values were generated from an empty workspace. Project repository URL remained empty (no project metadata access). No actual application data roots, user task repos, source/game/project data destinations, provider issues or real task data were accessed. Used only existing `/opt/data/bin/gh` authentication; no login, scope expansion, paid service, release, source commit/push/merge or schedule change. Remote Contents writes necessarily create commits **only in the expressly authorized synthetic data repository**; no source Git commits were made.

## Live checks actually executed

One-off runner started `2026-10-29T07:11:39.814Z`, finished `2026-10-29T07:11:54.181Z`, exit 0. All ten grouped assertions passed:

1. Exact new dedicated target ID/owner/privacy/nonfork and README-only initial root verified. Existing snapshot would have aborted this runner, not overwritten data.
2. Store A is off by default. Sync while disabled rejects; verification alone does not transfer; false consent rejects; explicit true consent enables.
3. A uploads synthetic task/project/category/milestone data through production runtime and actual GitHub Contents API. Production transport verifies exact readback bytes, content metadata, size and Git blob SHA. Task milestone assignment preserved. Outbound project `localPath` is empty, and device-A sentinel does not occur remotely.
4. Re-created A runtime/store reads persisted consent and data; unchanged sync returns verified with no new write.
5. Independent empty B root independently opts in. Initial sync only offers `download-required`; local data remains empty until explicit current `pullSha` confirmation. Pull preserves task/milestone data, leaves new project path empty.
6. B edits task title/status and milestone name, adds its own device-only path, and uploads using acknowledged expected SHA. Independent remote readback confirms edit and path redaction.
7. A offers rather than silently applies B's update. Confirmed pull restores updated data, retains A's own local path by project ID and saves previous task content to local rolling `.bak`.
8. Divergent A local and B remote edits yield conflict. Supplying the remote `pullSha` still cannot override both-side conflict. Exact local workspace, remote text/SHA and write count stay unchanged.
9. Injected offline identity blocks sync. Disable while offline succeeds, persists through runtime recreation and preserves local tasks and remote snapshot. This is a policy check, **not a real network outage**.
10. Final repository metadata remains private and pinned, with actual default-branch head/remote blob readback.

Additional read-only remote follow-up (`rifttask-cloud-process-restart-20261029.cjs`, exit 0): production `createAuth` verified the existing gh identity through actual `gh api user`, and a separate scratch root explicitly pulled the final synthetic remote snapshot. A **fresh Node process** reloaded that downloaded task/milestone and persisted ready config from disk; injected ENOTFOUND exercised cached offline auth, blocked transfer, and local disable preserved data. This proves process restart, not native application/device restart. Both harnesses use production transport `boundedExecute` with runner pinned to `/opt/data/bin/gh`; GUI executable discovery and Electron IPC are not covered by these network checks. No transfer failures or endpoint/permission bugs occurred; no production fix was necessary or invented.

## Every remote write: parent independent-readback handles

All snapshot writes use fixed path **`rifttask-workspace.json`**. README was GitHub auto-initialization, not a task snapshot.

| Operation/path | Blob SHA | Commit SHA |
|---|---|---|
| Initialize `README.md` | `869e7dd703e92b6c4f29e718dcad97b829806567` | `d32ae4caf3f488c03cefa5372e3b7b3d420b3602` |
| A first upload | `61b284f92b36e954e1b8dc907e0ada0a2f4d8fed` | `33a3aea0fe01f2a7fb61b6b4dce3135ecfb55376` |
| B edit upload | `39248ab70c58895bac56f374caa24108cf81b399` | `84c19adb77852daf1e62f8a7e393f2faaafbcc51` |
| B divergent upload (final remote) | `ecdd5ddbf7ba366bfbd0bd4107406ade35f7d010` | `432a3decdf299db9dfeb217d8b1b9a41ffc1d89f` |

Parent read-only commands (existing authentication; these inspect only the authorized synthetic repo):

```sh
/opt/data/bin/gh api repositories/1438071650 --jq '{id,full_name,private,fork,archived,owner:.owner.login}'
/opt/data/bin/gh api 'repositories/1438071650/contents/rifttask-workspace.json?ref=main' --jq '{path,sha,size}'
/opt/data/bin/gh api repositories/1438071650/commits/main --jq .sha
# Pin any table commit to verify the corresponding historical snapshot metadata:
/opt/data/bin/gh api 'repositories/1438071650/contents/rifttask-workspace.json?ref=33a3aea0fe01f2a7fb61b6b4dce3135ecfb55376' --jq '{path,sha,size}'
```

Retained local evidence under ignored `artifacts/cloud-live-20261029/`: `result.json` (checks/write ledger/metadata), `process-restart.json`, `upload-1.json`, `upload-2.json`, `final-remote.json`, and both harness sources. No credentials. All owned temporary account stores removed, synchronous child processes exited; no server/background worker was started. Remote repository/history deliberately retained. The first-upload harness refuses an existing snapshot; do not rerun by removing its guard or reset the remote history.

## Tests/build and remaining limits

`npm test`: **113 core/integration + 39 UI passed**, zero failed/skipped. `npm run build`: PASS, existing >500 kB xterm bundle warning unchanged. `git diff --check`: PASS. No production source or test code modified: the existing runtime passed the actual endpoint without a discovered defect. Parent independently re-ran the full **113 core/integration + 39 UI tests**, production build and whitespace checks, and read back all four remote write records at their exact commits. Each decoded Contents payload matched its recorded Git blob SHA; final `main` commit/blob matched the ledger and contained only the DUMMY workspace with empty remote `localPath`. Repository ownership/privacy were independently rechecked. No production source changed; documentation-only delivery follows this verification.

No native Electron/GUI network session or two-physical-device test here. Linux Electron previously blocked by missing GTK; Windows/macOS runtime/installers, signing/notarization and packaging on those operating systems remain unverified. No installer scripts or published release exist; do not substitute an unauthenticated release URL. Existing package scripts are the native developer-test handoff below, **not verified installation commands**. Conflict handling remains stop-only, not merge/force-overwrite UX. Private GitHub data/history are plaintext, not end-to-end encrypted. Device paths are stripped structurally; text manually entered into task titles/notes is not content-redacted. No guarantee of unlimited or permanently free provider capacity; this pass purchased nothing and ran no hosted Actions/deployment.

## Native test handoff (owner runs on the actual OS)

Prerequisites: Git, current compatible Node/npm, official signed-in `gh`, and native `node-pty` build prerequisites. Use a fresh clone of the parent's reviewed private feature branch and a fresh test profile; never reuse a real task workspace. These commands use only existing package scripts and were **not executed on Windows/macOS**:

```sh
gh repo clone wisedev-pstach/RiftTask RiftTask-native-test -- --branch feat/cloud-persistence --single-branch
cd RiftTask-native-test
npm ci
npm test
npm run native:rebuild
npm run build
```

Native development launch (macOS/Linux or Windows PowerShell):

```sh
npm start
```

Use a fresh OS test account if an existing RiftTask profile contains real data; there is no verified in-app test-profile selector. Do not rely on Chromium's `--user-data-dir` flag to isolate Electron's `app.getPath('userData')` without dedicated verification.

**Stop if the launch shows any pre-existing projects/tasks.** In the fresh empty app: verify the signed-in account, open Cloud persistence, verify exact `wisedev-pstach/RiftTask-Cloud-Test` (ID above), read plaintext/history consent, opt in, press Sync now and explicitly confirm download. Expect the final **DUMMY divergent B remote** task with edited dummy milestone and no configured local project path. Restart and verify persistence; disable cloud and verify task remains locally. This reads only the known synthetic test repository. Do not seed or upload actual tasks. Preserve the existing remote history.

Optional native packaging checks using existing scripts, not publication:

```sh
npm run pack
# On macOS only:
npm run dist:mac
# On Windows only:
npm run dist:win
```

These build commands do not establish that installers ran, signing is valid or the app works on another OS. Stop on dependency/lifecycle permission failures; do not blanket-approve install scripts, change shared credentials or expand GitHub scopes. Parent still owns source review/commit/push of the private draft PR; no merge/release authorized.
