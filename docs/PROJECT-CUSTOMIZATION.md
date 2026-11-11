# Project customization — 0.3.0

## Behavior and canonical data

- Project **Edit** is visible on every card; opening a project and editing are separate native keyboard-focusable buttons, never nested buttons. **Edit project** is also visible in the project header on every feature tab; the existing Project details edit action remains.
- The compact grid uses three columns at 1440 and two at 1024 in the verified layout. Cards show the actual icon, live category name/color resolved from `workspace.categories`, optional description and **Backlog / In progress / In review / Done** counts including zero. No category name/color copies are persisted on projects. Long names wrap.
- In the project editor, select a preset or **Custom emoji…**, then paste one emoji. Save/cancel and failed-save drafts use the existing guarded project save flow. Name, category, description, repository and local folder remain editable. Existing archive/restore behavior is unchanged.
- **Canonical representation:** the existing optional `projects[].icon` string is either one of the eight unchanged preset IDs or the exact Unicode emoji string. There is no second emoji field, HTML, URL, remote image or implicit migration. An absent icon remains absent through validation, store and cloud projection. Form-only `customEmoji` is removed before persistence.
- Browser-safe `desktop/project-emoji.json` shares the anchored Unicode structure and 64 UTF-16-code-unit limit with native validation. Both renderer and core additionally require exactly one `Intl.Segmenter` grapheme. Supported forms include common ZWJ families, skin tones, two-regional-indicator flags and keycaps. Reject words, multiple emoji, controls, URLs, markup, lone modifiers/indicators, invalid types and oversize values. Native color-emoji font fallbacks are local OS fonts; no production font/network dependency is added.
- **Compatibility:** update every syncing device/client to **0.3.0+ before using custom emoji**, including shared backups. The actual 0.2.0 baseline validator rejects custom emoji with `Invalid workspace: enum`; do not weaken older-client rejection or silently replace the value. The prior review-stage compatibility warning still applies. Workspace/cloud envelope versions remain 1. Strict canonical comparison, unknown-field rejection, size/protocol checks and local-image/path redaction are unchanged.

## Local folder and terminal recovery

- Start remains guarded by native availability, a nonempty saved local path, workspace activity and terminal activity. Distinct messages explain browser preview, unavailable desktop bridge, missing saved folder, workspace busy and pending explicit start.
- **Set local directory** / **Edit local directory** opens the proper project editor. Choosing a folder changes only the draft; save it before Start enables. Canceling the native picker or editor does not persist a path or start anything. Late picker completion is bound to its original input node, editor identity and workspace/navigation context, not a fresh document-wide query.
- A nonempty Windows/old-device path does **not** by itself explain a disabled Start button. On explicit start, main-process directory validation still rejects nonexistent/wrong-platform paths before spawning. The error explains choosing an existing local directory in Edit project, saving and retrying; the terminal exposes folder-edit recovery. No path deletion, automatic migration, guessed home directory, automatic shell start or cloud path transfer is introduced.
- macOS project PTYs now use fixed **`/bin/zsh -f`**, not Bash flags. Linux retains `/bin/bash --noprofile --norc`; Windows retains fixed system WindowsPowerShell with `-NoLogo -NoProfile`. Executables/arguments are main-process owned, never renderer-supplied or inherited from `$SHELL`. The clean environment still excludes `SHELL`, `ZDOTDIR`, app credentials and startup-hook variables. OS-global shell startup behavior remains OS-owned; `-f` disables user rc files. Bash installer scripts remain Bash intentionally.
- Retained session identity, nonce, account/path/inode checks, bounds, explicit input and teardown rules remain unchanged.

## Source installs and version clarity

README states that the public-main command builds source, not a versioned/signed release, and that no GitHub releases were published as of this source update. It does not pin normal installation to an obsolete feature commit or invent a release URL. A release requires separate owner authorization/publication.

Both installers read and validate actual `git rev-parse HEAD` and source package version on **main as well as pinned builds** before dependencies/building. They print source metadata then report version/source and the existing exact installed launch path only after successful publication. Existing full-commit verification, safe destination handling, staging/rollback and failure exits are retained. Fixtures now supply realistic Git/package metadata and reject invalid metadata before dependency installation or destination creation.

Settings displays the **installed** version from a zero-argument `getVersion()` IPC callback backed by Electron `app.getVersion()`. It has the same exact main-frame/sender/arity checks and exposes no executable/path/command argument. Browser preview is explicitly not an installed desktop app. README includes the macOS default `~/Applications/RiftTask.app`, read-only Info.plist version inspection, duplicate Dock/app-copy troubleshooting and the instruction not to delete task data or disable OS protections.

## RED → GREEN and final verification

Base: `b42fdaa08fc4f17aebd7ec46cfc2d7a9ad9a63a7` (0.2.0). All evidence is under `/opt/data/output/rifttask/project-customization/`.

| Tracer bullet | Actual RED evidence | GREEN evidence |
| --- | --- | --- |
| Unicode icon acceptance/rejection | `emoji-red.log`: old enum rejects emoji | `emoji-green.log`, `core-final-focused.log`, full suite |
| Reject non-string/property-coercion icon input | `emoji-type-red.log`: array-like preset accepted | final focused core + full suite |
| Semantic cards/category/counts/custom icon cancel/save | `cards-red.log`: no named article | `cards-green.log`, final UI/browser suites |
| Missing-folder editor recovery/save-before-enable | `terminal-red.log`: missing explanation/action | `terminal-green.log`, final UI/browser suites |
| Late directory-picker navigation fence | `picker-red.log`: obsolete completion changes draft | `picker-green.log`, full suite |
| Installed metadata IPC/Settings | `version-ipc-red.log`, `version-ui-red.log` | corresponding green logs + full suite |
| Source metadata on main | `installer-red.log`: absent source report | final full installer suites, including real local Git and simulated PowerShell fixtures |
| Package/root-lock 0.3.0 metadata | `metadata-red.log`: 0.2.0 mismatch | full compatibility suite |
| macOS fixed zsh command/flags | `mac-zsh-red.log`: `/bin/bash` instead of `/bin/zsh` | `mac-zsh-green.log`, final focused core + full suite |
| Wrong-device path error/recovery | `wrong-device-path-core-red.log`, `wrong-device-path-ui-red.log` | final focused core + full UI suite |
| Emoji font/fallback containment | `emoji-font-red.log` | `emoji-font-green.log`, inspected final screenshots |
| Readable card width at 1024/1440 | `card-width-red.log`: three columns instead of two at 1024 | final browser smoke |
| Unavailable desktop vs browser distinction | `native-unavailable-red.log` | full UI suite |
| Header edit on every feature tab | `header-edit-red.log`: missing header edit on details | `header-edit-green.log`, full UI suite |

Final commands and real results:

```sh
RIFT_PWSH=/opt/data/cache/scratch/rifttask-pwsh/pwsh \
DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1 taskset -c 0 npm test
# Core: 282 total, 275 passed, 7 skipped, 0 failed.
# UI: 13 files, 94 passed, 0 failed.
npm run build
# Passed: 29 modules; usual >500 kB bundle-size advisory remains.
bash -n scripts/install.sh
# Passed. Explicit PowerShell ParseFile via RIFT_PWSH also passed.
node --test tests/project-customization.test.cjs tests/pty.test.cjs
# Passed (core-final-focused.log).
FONTCONFIG_FILE=/opt/data/cache/scratch/rifttask-emoji-font/fonts.conf \
node scripts/customization-browser-smoke.cjs
# Passed, 32 screenshots, zero page errors/external requests; no native PTY starts.
FONTCONFIG_FILE=/opt/data/cache/scratch/rifttask-emoji-font/fonts.conf \
RIFT_SCREENSHOT_OUTPUT=/opt/data/output/rifttask/project-customization/progress-regression \
node scripts/progress-browser-smoke.cjs
# Passed, original 27-screenshot progress/filter/review/raster/clipboard regression.
git diff --check
# Passed.
```

The seven normal-suite skips are six opt-in real package/archive checks plus the PATH-only `pwsh` parser probe; the explicit configured PowerShell parser and simulated-COM installer tests ran successfully. The host has no `/bin/zsh`; platform-command tests use a captured spawn dependency, not a claimed macOS native shell execution. No zsh installation was attempted.

Persistence coverage exercises real temporary store restart, ordinary edit, native-service backup export/import, strict cloud projection/restore, exact emoji preservation, unknown-field rejection and device-only path redaction. UI coverage includes all project fields, failed-save draft retention, live category color, old Today values/rich progress, separate open/edit, zero counts, busy gates, missing-folder cancel/save, unavailable browser/desktop and nonempty wrong-device path recovery. Existing account/root/session/cloud regressions remain in the full suite.

## Parent verification and independent review

The parent independently repeated the complete configured-PowerShell core suite (**275 passed, 7 skips, zero failed**), renderer suite (**94 passed, 13 files**) and production build. Logs: `parent-tests.log` and `parent-build.log` in the evidence directory. Read-only review `deleg_2c2fe910` found no actionable security, data-loss, shell or UI-race regressions; it separately accepted 7 preset/emoji/cloud cases and rejected 13 malformed/unsafe icon inputs. Parent inspected the actual synthetic project-grid and missing-folder recovery screenshots. Native-platform and two-device acceptance remain separate.

## Screenshots and limits

`customization-browser-result.json` enumerates all **32** customization screenshots and assertions. Each of dark/light × 1024/1440 includes:

- `before-projects-{theme}-{width}.png`: actual 0.2.0 source rendered with its existing synthetic progress fixture.
- `after-same-fixture-projects-{theme}-{width}.png`: new UI with the same existing fixture for comparison.
- `projects-{theme}-{width}.png`: six clearly synthetic projects, including emoji, all-zero counts and a long name.
- `emoji-picker-{theme}-{width}.png`.
- `terminal-missing-folder-{theme}-{width}.png` and `terminal-saved-folder-{theme}-{width}.png`.
- `settings-version-{theme}-{width}.png` and `terminal-browser-unavailable-{theme}-{width}.png`.

Final dark-1440/light-1024 project grids, picker, folder states and version Settings were loaded and visually inspected. Real Chromium reports no nested buttons or card overflow. Preview identities/data/bridge are synthetic; the ready-folder screenshot demonstrates saved-state gating, not filesystem validation or a running shell.

The minimal Linux image initially had no emoji font and showed tofu. Acceptance runs use an external-to-repository scratch Fontconfig file plus a downloaded Noto Color Emoji font at known source commit `22e564626297b4df0a40570ad81d6c05cc7c38bd`; no font asset or automatic font download ships in the application. Actual native macOS/Windows glyph rendering, signed distribution, installation/launch, macOS zsh/PTY operation and live two-device cloud sync remain owner acceptance gates.

Browser reproduction requires Vite on `127.0.0.1:33865` for this tree and `:33866` for a scratch `git archive` of the base; the script never reads real account data. `source-fingerprints.json` records SHA-256 of the changed source/evidence files after verification. No commit, push, merge, tag, release, native install, live account/cloud/config operation or `.local` cleanup was performed. Parent review and PR publication remain separate.
