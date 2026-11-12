# Task-local file and folder references — 0.4.0

## Use

In New/Edit task, **Files & folders** appears directly below Notes. Choose file / Choose folder uses separate native single-selection dialogs, or paste an absolute path, select File/Folder and optionally add a display label. Click **Add reference**, then **Save task**. A newly added reference says **Save task first** and cannot Open until saved. An empty label displays the path basename. Saved references have separate **Open** and **Remove reference** actions.

Cancel leaves the saved task unchanged. Save errors preserve the draft. Native picker cancellation leaves its input unchanged; late completions cannot update another editor, another project/navigation context, or a newer manually typed path. Save/Cancel remain in a fixed footer outside the task fields' scroll area.

These are references, **not uploads or attachments**: no file contents are copied into the workspace, exported, uploaded, deleted, or automatically opened. Removing a reference is a draft edit until Save and never deletes the actual file/folder. Notes are not parsed for URLs or converted to references. A path copied from another device may be stored but cannot Open unless it exists as the expected native object on this device. Missing and refused paths produce an inline error without losing the draft.

## Data and privacy

Optional task field:

```json
"localResources": [
  {"id":"reference-1","name":"Design brief","path":"/Users/example/Design notes/Brief.pdf","kind":"file"}
]
```

- At most 20 references/task; unique safe IDs up to 100 characters, display label up to 200, literal path up to 4096. Kind is exactly `file` or `directory`; unknown entry fields are rejected.
- Absolute POSIX and Windows drive paths, spaces and Unicode can round-trip offline without filesystem access. URL/protocol paths, network-share/UNC paths and C0/C1 controls are rejected. Paths are not trimmed or expanded as shell strings. No home-variable, tilde or command expansion.
- Legacy tasks without the field keep it absent. Ordinary task/status/progress edits preserve it. The existing 8 MiB workspace cap still applies.
- **All reference metadata** (paths, labels, IDs and kinds, including empty arrays) is removed before cloud snapshot sizing. No new wire count field is introduced. Existing cloud wire readers do not need a new reference schema.
- Incoming remote reference fields fail strict canonical validation, including an injected empty array. Restore retains existing local references only when both task ID and project ID match, then revalidates the complete merged workspace and size. Missing/deleted local task identity means nothing is reattached.
- Explicit local workspace backups **do include paths and labels**, never referenced file contents. Treat backups as private device metadata. Old app builds may omit new fields during local save/import; use 0.4.0+ when editing backups or local workspaces with references. Unrelated icon/status all-device compatibility requirements remain unchanged.

## Native Open security boundary

The renderer can request `openTaskResource(taskId, resourceId)` only. It cannot pass an arbitrary path to Electron shell APIs. Main resolves the current persisted entry in the trusted active account's store, checks its current project, native absolute path and resolved filesystem object, and dispatches **only an explicit click** through `shell.openPath`. There is no `openExternal(file:)`, shell command, process spawn or renderer-supplied executable configuration.

Regular files require both the requested and resolved filename extensions to be in the conservative document/media set in `desktop/task-resources.cjs`. Unknown types, scripts, shortcuts and executable extensions are refused. Unix executable permission bits, executable/shebang header signatures, application/bundle path components (including `.app`, `.bundle`, `.framework`, `.plugin`, `.workflow`) and non-regular objects are refused. The bounded header read uses no-follow/nonblocking flags where the platform provides them, verifies the opened object identity/type/mode, and closes the handle. No file bytes are returned to the renderer. Refusal is labeled **Open refused**, not disguised as a Reveal action; no Reveal action is added in this version.

Folder references must resolve to an actual directory and must not traverse a launchable bundle path. Intentional symlink references may open their inspected resolved target, including folders outside the repository. There is no invented project-root sandbox. Resolved executable/special targets and broken links fail closed.

Exact trusted main-frame IPC and arity checks precede dispatch. Account generation, cancellation generation, persisted task/project/reference identity and live renderer authorization are checked across asynchronous operations before native dispatch, and again after the opener returns. Save, editor/navigation cancellation, logout, account switching, renderer loss/window close and disposal invalidate pending actions. A native open already handed to the operating system cannot be recalled. Electron's path-based OS handoff is not an atomic filesystem snapshot or a malware sandbox: another local process can still change filesystem contents after inspection. Default applications and documents run with the user's normal OS permissions, as disclosed inline; this does not sandbox document macros, file associations or application vulnerabilities.

## Parent verification and final review

Final read-only review `deleg_3dd2c8bf` approved the corrected draft-project picker and two-check resource authorization with no security or logic blockers. The parent independently passed all **69 focused filesystem/resource tests**, the complete **107-test renderer suite**, and the production build after those fixes (`review-fixes/parent-focused.log`, `parent-ui.log`, `parent-build.log`). Final full worker evidence is **345 core passes, 7 skips, 107 UI passes**; earlier 299/105 counts are historical. Production appearance did not change during the service fixes, so the 24 component-preview screenshots remain applicable. Real Finder/Explorer/default-application opening is still owner acceptance.

## Verification and limitations

Evidence directory: `/opt/data/output/rifttask/task-local-resources/`.

- Vertical baseline failures are recorded in `persistence-red.log`, `cloud-red.log`, `open-red.log`, `lifecycle-red.log`, `ipc-red.log`, `ui-red.log`, `layout-red.log`, `navigation-red.log`, `picker-edit-red.log`, `literal-path-red.log`, `renderer-close-red.log`, `file-race-red.log` and `metadata-red.log`. They cover dropped persistence, leaked cloud metadata, missing native/UI APIs, same-workspace save invalidation, inaccessible layout structure, stale picker results, literal path trimming, renderer cancellation, filesystem mode races and version metadata respectively. Later boundary/security regressions exercise the implemented behavior too; no fabricated provider/native responses are presented as real execution.
- Real temporary account store save/restart/status edit and explicit service export/import; cloud redaction/restore/injection, final merged 8 MiB cap; real document/folder/symlink/socket filesystem inspections with an **injected recording OS opener**; IPC/preload/native-dialog wiring and lifecycle race tests. No genuine user file or application is opened.
- Full verification command: `RIFT_PWSH=/opt/data/cache/scratch/rifttask-pwsh/pwsh DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1 taskset -c 0 npm test`; production `npm run build`. Final counts and source hashes are in `verification.json`, with unabridged logs beside it. Packaging/native-archive skips are explicit in the test log. Vite retains its existing >500 kB bundle-size advisory.
- `scripts/task-resources-browser-smoke.cjs` uses real headless Chromium against `docs/previews/task-local-resources.html` with clearly synthetic data and simulated native actions. It captures saved, draft, failed-save, cancelled, missing and unsafe states in light/dark at 1024 and 1440: **24 screenshots**, zero external requests and no page errors. Save is measured in-viewport and center hit-tested in every state, not made visible by auto-scrolling the Save button. `browser-result.json` records exact geometry. Visual inspection covered the saved/draft/error states; existing restrained theme tokens/layout are retained, not redesigned.
- Native Electron 45 cannot start on this Linux container: `libgtk-3.so.0` is missing (exit 127). No macOS/Windows GUI, Finder/Explorer/default-application execution, native installation or live GitHub cloud/provider test is claimed. Native dialogs/openers were verified through injected main/service integration, not OS GUI automation.

## Review fixes — draft project and bounded identity checks

Evidence: `/opt/data/output/rifttask/task-local-resources/review-fixes/`.

- A native picker in Edit task authorizes the existing saved task in its original active project **separately** from the selected active destination project. Changing Project in the draft does not require saving first. The picker never saves that move or the reference. After the dialog, the original task must still exist in the same saved project, and both projects must still be active; otherwise the result is discarded.
- Resource actions use at most **two** fresh `auth.session()` calls, scoped to that action only: once before reading saved context/dialog dispatch, and once immediately before native Open (with no intervening await) or after the picker before publishing its result. There is no global auth cache and no change to cloud/backup identity paths. Binding and generation are captured before the first auth await; stale auth responses cannot rebind a newer session. Synchronous guards check cancellation generation, account generation/binding, disconnect-in-progress and live renderer authorization immediately after intermediate awaits, including the OS opener return. Open still re-resolves and compares the persisted reference before final identity verification; picker revalidates saved task/project context after final verification.
- Genuine RED→GREEN: `draft-picker-red.log` records **2 failing** real-service tests (file/folder with an unsaved destination), then `draft-picker-green.log` records **20 passing** service tests. `auth-count-red.log` records **2 failing** call-count tests (Open made 6 checks, picker 4), then `auth-count-green.log` records **22 passing** service tests with exactly 2 checks per successful action.
- Final `full-tests.log`: **345 core passed, 7 skipped, 0 failed** (352 total); **107 UI passed** across 14 files. It includes missing/archived destination and task rejection, pending-dialog task removal/project changes, cancellation without persistence, delayed first/second auth switch/rejection/logout/switch-back/renderer fencing, store-await cancellation, and post-opener lifecycle fencing. UI coverage selects another project, picks/adds, then Save or Cancel; only Save moves the single task with its references.
- Final `build.log`: production build passed; the existing >500 kB advisory remains. `verification.json` records current source SHA-256 fingerprints and parsed test totals. No production renderer/CSS or browser harness source changed in these review fixes, so the existing **24 appearance screenshots** are reused; only service behavior and automated tests changed.

No commit, push, PR, merge, tag, release, publication, real account access or auth change was performed by this implementation worker.
