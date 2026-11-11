# RiftTask

Local-first desktop task manager with public source for a solo developer. User requested a paced two-day build, with occasional Discord progress updates. No questions: make sensible defaults. Never fetch provider issues or tasks. Only this new project is in scope, not the user's existing games or work repositories.

## Stack
Electron main/preload (.cjs), React JSX renderer, Vite. Core is CommonJS in desktop/*.cjs for direct node:test coverage. No server or paid backend. GitHub login uses the user's installed official GitHub CLI (`gh`), not an embedded third-party OAuth client ID. Public-source installers must not require, discover, install or authenticate gh. Clone public HTTPS main with Git; preserve optional exact-commit fetch/checkout/readback. Official gh remains a separate app first-use identity/private-cloud prerequisite. Never pass tokens to renderer or persist them in app data. Persist account data under Electron userData/accounts/<numeric GitHub ID>/workspace.json using atomic writes and backup. Persistence is LOCAL to the device; do not claim cloud sync. Offline resume may use last verified account identity, clearly disclosed; this is not an OS security boundary.

## Test discipline
Load test-driven-development. Implement vertical slices: write a failing behavioral test, run it, implement, rerun green. Record actual commands and evidence in docs/TEST-EVIDENCE.md or task-specific evidence files. No fabricated results. Tests use node:test for core and vitest + testing-library for React. No external writes, pushes, release publication or auth changes by subagents unless specifically instructed.

## Bridge contract (window.rift)
All methods return Promises. Renderer MUST NOT import Node.
- session(): {account: {id:number,login:string,name:string}|null, offline:boolean, ghAvailable:boolean}
- login(): session shape, or {account:null,offline:false,ghAvailable:true,loginPending:true}; main process reuses a verified CLI account or starts fixed gh auth login in a native terminal on macOS/Windows. Launch is not authentication; Linux/errors provide a manual fallback.
- checkLogin(): strictly verifies gh api user without launching authentication or accepting offline identity; resets pending launch so a failed check permits explicit retry.
- logout(): disconnect app locally only; do not revoke shared gh authentication.
- load(): Workspace (requires active account)
- save(workspace): validated persisted Workspace
- chooseDirectory(): string|null (native dialog)
- openRepository(url): void (validated HTTPS GitHub/Azure DevOps only)
- openProgressLink(url): void (explicit click only; credential-free HTTP/HTTPS, ≤2048 characters; exact trusted main-frame and argument validation)
- cloudStatus(), cloudCreate({name,consent:true}), cloudVerify(name), cloudEnable({repositoryId,consent:true}), cloudDisable(), cloudSync({pullSha?}): manual opt-in cloud operations; never transfer on sign-in or setup alone.
- ptyStart(projectId), ptyRead(projectId,sessionId), ptyInput(projectId,sessionId,data), ptyResize(projectId,sessionId,cols,rows), ptyClose(projectId,sessionId): retained project-scoped native shell; persisted directory and verified identity only.
- openTerminal(projectId): void (path taken from persisted workspace, never renderer-supplied shell text)
- gitStatus(projectId): {branch:string,changed:number}|null (only explicit request, no fetch)
- exportBackup(): boolean (native save dialog)
- importBackup(): Workspace|null (native open dialog, validation, backup of current data)

Workspace = {version:1,categories:[{id,name,color}],projects:[{id,categoryId,name,description,repositoryUrl,localPath,archived:boolean}],tasks:[{id,projectId,title,notes,status:'backlog'|'doing'|'review'|'done',priority:'low'|'normal'|'high',dueDate:'YYYY-MM-DD'|'',today:boolean,createdAt:ISO,completedAt:ISO|null}],updatedAt:ISO}.
Legacy version-1 input with exact status `next` is accepted and normalized to `backlog` without dropping tasks or changing other known fields. Loading a valid legacy file does not rewrite it; explicit save stores canonical values and the existing rolling backup contains the normalized previous workspace, not raw original bytes.

Blank account starts empty. Version-1 workspaces may additionally contain `milestones:[{id,projectId,name,color}]` and task `milestoneId` (empty string = unassigned). These optional fields are preserved; old v1 files lacking them remain valid and are not rewritten on load. Labels require an existing project, unique safe IDs, name ≤200 characters, hex color; assigned tasks must reference a milestone in the same project. No implicit deletion of labels/assignments. Cloud canonical snapshots preserve both fields; old clients fail closed on unsupported milestone data rather than silently stripping it.

Blank account starts empty. Optional explicit sample workspace button can seed Games / lose.DOT, clearly labeled sample and never pretend imported data. Renderer builds IDs with crypto.randomUUID. Core normalizes/validates values with limits, referential integrity and safe IDs. Categories/projects with descendants cannot silently delete them: explicit confirmation/cascade or archive. Task UI: create/edit/delete, status, priority, due, notes and separate task progress; category/project create/edit with built-in icons; independent category collapse; search, all-active-project In progress (status doing, not legacy Today pins), project overview, board/list; empty/error/loading states; keyboard-friendly forms; project context for repository and terminal.

## Optional project/progress fields
Projects may carry `icon` from `desktop/project-icons.json`; absence uses a renderer-only default. Tasks may carry `progress:[{id,createdAt,body,links,images?,imageCount?}]`. See `docs/PROJECT-PROGRESS.md` for limits and security rules. Absence remains absent; never rewrite a legacy workspace on load. Preserve legacy `today` values without showing obsolete pin controls/badges.

Progress Markdown is a literal bounded string; render only allowlisted React AST nodes from pinned marked tokens. Never use innerHTML, remote Markdown images or automatic previews. Explicit HTTP(S) URLs use the narrow opener; clipboard copy is user-triggered. PNG/JPEG/WebP inline image data is LOCAL and included in backups, excluded entirely (including names and IDs) from cloud projection; only counts travel. Strict remote canonical comparison rejects image payload fields rather than silently stripping them. Restore images only for matching project/task/entry IDs, and run final workspace size validation.

Category collapse is localStorage UI state under `rifttask:collapsed:<positive numeric account ID>`, never workspace/cloud data. Retain TerminalDock across settings/project navigation.

## Ownership while building
- Backend agent: desktop/core.cjs, desktop/store.cjs, desktop/auth.cjs and corresponding tests only; docs/backend-evidence.md.
- UI agent: src/**, index.html and renderer tests only; docs/ui-evidence.md.
- Parent: package config, desktop/main.cjs, desktop/preload.cjs, integration tests, docs, scheduling, git and GitHub.

## Build milestones
1. First session: repository, app foundation, real task UI + tests + persistence tests. Commit/push verified foundation, report what is NOT done.
2. Later pass: repository/native-terminal integration, auth flow hardening, account switching/restart tests, backup/restore.
3. Next day: Windows/macOS installers, CI builds and smoke checks, security review. No unsigned-release or one-command-install claims until verified. Existing GitHub token lacks workflow scope: pushing .github/workflows may be blocked; do not bypass via another identity. The owner has now made the source repository public and authorized anonymous HTTPS installation from main. This supersedes the original private-only/authenticated-download mandate. Planning-data cloud repositories must remain separate, user-owned and private; public source does not remove app sign-in. No release/publication actions unless explicitly authorized.

Project path: /opt/data/projects/RiftTask. Repository: https://github.com/wisedev-pstach/RiftTask. GitHub CLI on this host: /opt/data/bin/gh. Never print credentials.
