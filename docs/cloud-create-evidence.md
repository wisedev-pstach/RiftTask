# Explicit private cloud repository creation — verification

## Scope and boundary

Settings → Cloud now offers **Use existing repository** and **Create private repository**. Creation requires a valid name in the active personal account, strict `consent: true`, and a native exact-target dialog with Cancel as its default/cancel action. It creates only a private README-initialized repository. **Verify repository → separate plaintext/history sync consent → Enable manual cloud → Sync now** remains the transfer path.

No actual GitHub repository was created, no remote contents were read or written, no authentication scopes were changed, and no commit/push was performed for this verification. All repository API responses below are injected fixtures. Tests exercise real production runtime/service/IPC/preload/transport code; subprocess tests execute real local Node children. Browser screenshots use the built renderer with an isolated dummy bridge, not Electron/native dialogs or live GitHub.

## RED → GREEN observations

- Initial `node --test tests/cloud-create.test.cjs`: 2 failures, missing `transport.createRepository` and `cloud.create`. After the first production slice: 2 passed.
- Native/preload slice: `node --test tests/ipc.test.cjs` failed for missing `cloudCreate` in the frozen bridge and missing `confirmCloudCreate` callback. `npm run test:ui -- src/CloudPanel.test.jsx` failed for missing Create private repository action.
- Error-classification slice: `node --test tests/cloud-errors.test.cjs` initially failed both sanitized HTTP classification and production bounded-executor status extraction.
- Additional regression RED: known successful POST followed by failed metadata readback lost the known-created marker; disabling during deferred Verify still allowed a stale selection. Both reproduced, then passed after readback outcome preservation and epoch-guarded verification.
- Additional regression RED: create mode was not disabled during initial configuration loading. Added the creation-specific loading lock.
- Additional regression RED: control-character/non-string default branches were not rejected by repository policy. Hardened validation; unsafe readbacks now leave cloud off.

Raw RED logs are retained at `/opt/data/cache/scratch/rift-create-{ipc,ui,policy,loading,branch}-red.log`.

## Coverage

- Fixed `github.com` host, bounded timeout/output, JSON on stdin, no shell; POST `/user/repos` explicitly sets `private: true`, `auto_init: true`, generic description and disabled issues/projects/wiki.
- Exact-name metadata GET follows POST; POST and readback numeric IDs must match. Only narrow repository metadata crosses the bridge.
- Strict creation consent, native cancellation, active-account-only namespace, unsafe names/length, duplicate concurrent attempts, create/verify locking, account switch during native confirmation and during creation, wrong owner/public/fork/archived/source identity and invalid branch rejection.
- Existing enabled cloud is preserved; linked project/source names block creation. Creation does not persist cloud configuration, verify a selection, read snapshot contents, upload tasks or enable sync.
- Uncertain POST/readback has no automatic retry, adoption, overwrite or delete. Known remote creation is reported separately from an unknown outcome; 422 never adopts an existing repository.
- End-to-end local fixture: actual preload promise bridge → trusted IPC → service → cloud runtime → production transport with injected CLI responses. Invalid sender/arity/consent and cancellation make zero API calls. Successful creation makes exactly POST + metadata GET, stays off, then independent Verify makes only a metadata GET before separate enablement.
- Auth/401, permission/403, ambiguous not-found-or-inaccessible/404, validation/422 and connection failures use fixed safe messages. CLI stderr/body text is never exposed.

## Final execution

- `RIFT_PWSH=/opt/data/cache/scratch/rifttask-pwsh/pwsh DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1 PATH="/opt/data/cache/scratch/rifttask-pwsh:$PATH" npm run test:core`: **236 tests; 230 passed, 0 failed, 6 skipped**. The skips are opt-in packaged-icon/archive checks, not cloud tests. PowerShell fixture suites executed on Linux; not native Windows proof.
- `npm run test:ui`: **7 files, 65 tests passed** (includes the concurrently implemented startup-screen tests, outside this cloud change).
- Final targeted cloud/native-bridge run after the branch-validation extension and readability refactor: **50 passed, 0 failed**.
- `npm run build`: passed. Existing bundle-size warning remains (~589 kB minified JS).
- `git diff --check`: passed.

Logs: `/opt/data/cache/scratch/rift-create-core-final.log`, `rift-create-ui-final.log`, `rift-create-build-final.log`, `rift-create-targeted-green.log`.

## Screenshots

`node docs/capture-cloud-create.cjs` starts and stops its own local Vite preview. It verifies one retained Settings/Cloud instance through repeated navigation, zero enable/sync calls, disabled enablement after independent Verify, no page errors and no horizontal overflow.

- `/opt/data/output/rifttask/cloud-create/creation-confirmation-dark.png` — explicit exact-target creation-only consent, before the native confirmation.
- `/opt/data/output/rifttask/cloud-create/created-not-enabled-dark.png` — synthetic success, cloud still off, next action Verify.
- `/opt/data/output/rifttask/cloud-create/browser-checks.json` — `create:1`, `verify:1`, `enable:0`, `sync:0`, `status:1`; no errors.

Both images visibly disclose dummy data and simulated native/cloud actions, and were inspected for legibility/clipping. Real native confirmation and live provider creation remain intentionally unverified; they need separate exact-destination authorization and native-platform acceptance.
