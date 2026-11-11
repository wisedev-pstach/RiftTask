# Project icons and task progress

## Current request (project customization, 0.3.0)
Custom single-emoji project icons alongside the eight presets; compact project cards with live category/color and all four state counts; separate card Edit plus visible project Edit controls. Explain native/browser/busy/missing-folder terminal states, explicit folder editor recovery and saved-path native validation (never guess a macOS replacement for a Windows path). Fence late directory-picker completion to its original workspace/editor. macOS project PTY uses fixed `/bin/zsh -f`, with Linux Bash/Windows PowerShell unchanged; Bash source installers remain Bash. Show the installed version via zero-argument trusted metadata IPC and report actual source HEAD/package version for main and pinned source installs. Clarify no published GitHub releases, main is a source-build preview. Preserve cloud redaction, strict unknown-field checks, legacy pins, four stages and retained sessions; custom emoji requires all syncing clients updated. No publication/native install/live cloud; parent review then PR-only.

## Prior request (PR11 follow-up)
Replace Today with global In progress showing only `doing` tasks across active projects, independent of legacy pins/due dates. Add an All categories / specific category filter, honest empty states and account/stale-category reset. Add persisted `review` (In review) between doing and done across task UI, strict storage/backup/cloud validation, preserving rich progress, icons, local images and legacy values. Update all clients before syncing review tasks: 0.1.1 rejects this new enum. Target 0.2.0; no schema-envelope migration, publication or real account access.

## Original request
User message `1568655198606332048` requests project icons, category-level collapse, an all-project In progress tab replacing Today, and task progress input supporting notes, images and links. Scope is RiftTask only. Base `d778b70`, branch `feat/project-icons-task-progress`.

## Acceptance
- Choose a project icon in create/edit; display it consistently in project tiles/sidebar/header with a default for old projects. Prefer a compact built-in icon picker, not remote image dependencies.
- Expand/collapse each category's project list independently, with accessible disclosure and local persisted view preference. Category navigation remains available and collapse does not archive/delete projects.
- Replace Today navigation with In progress, listing status `doing` across active projects, retaining project context/search and click-through. Do not destroy existing `today` data merely because the old navigation is removed.
- Add an append-style per-task progress feed with timestamped entries, note text, explicit links and local image attachments. Support real add/display/remove interactions without mixing entries into the existing task description. Preserve existing workspaces losslessly when optional new fields are absent.
- User message `1568656478728884427` adds readable rich formatting: a lightweight Markdown toolbar and preview for bold/italic/lists/code/links; distinct readable URL presentation with hostname/label, copy/open actions and full-URL tooltip. Render escaped/safe React elements, never raw HTML or unsafe protocols; no automatic website previews or remote image fetching. Image thumbnails should be useful and optionally enlarge in-app. Verify dark/light readability and malicious markup/link rejection.
- Keep image payloads local to the existing bounded workspace; include them in local backup/import, never in GitHub cloud snapshots. Cloud may carry progress text/links and icon metadata. Preserve matching local images on remote pulls and describe unavailable remote-device images honestly, not as synced binaries.
- Respect existing 8 MiB workspace and cloud payload limits, bound entries/images and show actionable errors. Accept raster PNG/JPEG/WebP only, reject SVG/active/data/file/javascript link payloads and remote image auto-fetching. No HTML injection or arbitrary filesystem/credential access.
- No real user task-data reads/uploads, new cloud repository, auth changes or unrelated cleanup. Preserve the denied `.local` cleanup restriction.

## Delivery
Strict vertical RED/GREEN, persistence/restart/backup/cloud projection regressions, UI behavior tests, production build, actual browser smoke and inspected dark/light screenshots. Independent review before publication. Keep native and simulated bridge evidence separate. Prefer a focused reviewed PR/source handoff; no unrelated scope expansion or schedules.
