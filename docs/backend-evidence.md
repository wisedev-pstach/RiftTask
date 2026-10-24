# Backend API and verification

CommonJS modules; no npm install needed. Integration contract fixed:

- `core.emptyWorkspace()` returns a fresh empty version-1 Workspace.
- `core.validateWorkspace(input)` returns a clean detached validated Workspace; rejects invalid values with `Invalid workspace: ...`. Unknown properties are discarded, required labels trimmed. No implicit timestamps/status changes.
- `store.createStore(userDataRoot)` returns synchronous `load(numericAccountId)` / `save(numericAccountId, workspace)`. IDs must be positive safe integer numbers, not strings. Data lives at `<root>/accounts/<id>/workspace.json`; previous valid save at `.bak`. Save returns clean workspace.
- Recovery: valid backup is restored, original preserved as `.corrupt-<uuid>`, and first load throws `WORKSPACE_RECOVERED` with `recovered:true,corruptPath`. Display notice and retry load. Without usable backup, `WORKSPACE_CORRUPT` blocks load/save, retains files; do not replace with empty data.
- `auth.createAuth({run,cachePath})` returns asynchronous `session()`, `login()`, `logout()`. `run(file,args,options)` must return Promise stdout string (not `{stdout}`). Default runner wraps Node `execFile`, never a shell; 15-second timeout, 64 KiB output ceiling, hidden Windows console. Only invokes `gh api user --hostname github.com`. Session result is `{account:{id,login,name}|null,offline:boolean,ghAvailable:boolean}`. Parent owns native-terminal login.
- `login()` always requires current verification; failure is a sanitized actionable error directing `gh auth login --hostname github.com`. It never starts login/logout/revoke or returns an offline identity as verified.
- `session()` permits the last verified cached account only on recognized connection failures or missing gh, disclosed via `offline:true`; missing gh sets `ghAvailable:false`. Invalid identity or rejected authorization clears cached identity. Only sanitized ID/login/name are cached; never tokens/provider response extras. Cache is local convenience, NOT an OS security boundary.
- `logout()` clears identity, persists local disconnect, and never touches shared gh credentials. Subsequent sessions (including after restart) remain disconnected until explicit `login()`. Calls are serialized so in-flight verification cannot overwrite logout. While disconnected `ghAvailable` is last observed availability (initially true), not a fresh CLI probe.
- `core.createSampleWorkspace()` is explicit optional sample Games / lose.DOT, visibly labeled sample. No automatic seeding and no external imports.

Validation limits: 1,000 categories / 5,000 projects / 10,000 tasks; clean serialized workspace <=8 MiB; IDs 1–100 ASCII alphanumeric/underscore/hyphen starting alphanumeric; names 200 chars, title 300, notes/description 20,000, local paths 4,096, repository URLs 2,048. Real dates and UTC ISO timestamps, enum/boolean types, duplicates and foreign references checked. HTTPS repositories restricted to github.com, dev.azure.com, *.visualstudio.com.

## Actual execution evidence

Executed from `/opt/data/projects/RiftTask`, Node built-in runner (no npm install):

```text
node --test --experimental-test-coverage tests/core.test.cjs tests/store.test.cjs tests/auth.test.cjs
15 tests; 15 pass; 0 fail; 0 skipped
core.cjs: 100.00% lines; 98.51% branches
store.cjs: 100.00% lines; 83.87% branches
auth.cjs: 97.30% lines; 95.00% branches
```

Observed red → green feature slices: missing empty/domain module → empty API; validation test discarded properties failure → schema validation; missing store → restart/account isolation; missing backup and raw corrupt JSON failure → backup/recovery; missing auth → verified identity; offline ENOTFOUND failure → offline cache; missing logout → persisted disconnect; in-flight logout race failure → serialized operations; stale offline identity after HTTP 401 failure → identity invalidation; symlink redirect missing rejection → safe path checks; missing optional sample API → explicit sample generator. Final regression additions cover complete Unicode/completed-task roundtrip across two accounts and UTF-8 byte limit independently of per-field limits.

Tests use actual temporary filesystem directories beneath `TMPDIR`, real JSON readback, new store/auth instances for restart, and injected process runners for all auth scenarios. No live gh login/logout/revoke was performed. Default `execFile` wrapper is not exercised against real gh; this is not a native Electron/installer smoke test.

Persistence uses mode-0600 exclusive temporary files, file fsync and same-directory rename; previous valid version is independently atomically replaced as `.bak`. Failed validation cannot alter primary/backup. Existing symlink account directories or workspace/backup paths are refused. Single Electron main process is the intended writer; no cross-process locking or multi-device sync is claimed. Local account isolation and offline identity are not a hostile-OS security boundary.

Files owned by this milestone only: `desktop/core.cjs`, `desktop/store.cjs`, `desktop/auth.cjs`, `tests/core.test.cjs`, `tests/store.test.cjs`, `tests/auth.test.cjs`, `docs/backend-evidence.md`. No commits/pushes or modifications to renderer/main/preload/package files.
