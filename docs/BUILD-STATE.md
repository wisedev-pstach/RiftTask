# RiftTask — build state

## Mission
Create a private desktop task app for wisedev. Categories → projects → manually maintained tasks. GitHub sign-in; persistent data per account; repository links for GitHub and Azure DevOps; terminal integration; Windows/macOS installation in one command. No provider issue/task imports. No questions; choose sensible defaults. Work incrementally across two days, occasional progress to Discord DM 1562209904591372359. Never publish publicly, use paid services, modify other repos, revoke existing authentication, or expose credentials.

## Environment
- Repository: https://github.com/wisedev-pstach/RiftTask (private; created and read back).
- Local: /opt/data/projects/RiftTask, git main.
- GitHub CLI: /opt/data/bin/gh, authenticated wisedev-pstach; token has repo/read:org/gist, NOT workflow scope. Existing credential file owner-only must stay private. Never print tokens.
- Dependencies installed; initial backend/UI agents completed. Current continuation status and evidence are recorded below.
- Persistent disk started with 18 GB free. Check before building; never accumulate installer/build caches unchecked.

## Architecture
Read AGENTS.md for exact bridge/schema and test discipline. Electron/React/Vite. Local JSON persistence isolated by verified numeric GitHub ID with atomic writes/backups. Sign-in through official installed gh CLI avoids registering/borrowing an OAuth application. Account data persists on this device; no cloud sync yet. Explain this honestly. Private repository installation must use authenticated downloads, NOT public raw URLs.

## Ordered remaining work
1. Verify initial core/UI and Electron bridge foundation; tests/build and private push. This is first milestone, not a finished release.
2. GitHub/Azure repository URL validation; native directory selection; read-only local git branch/change count; native terminal launched in chosen workspace. No auto executing arbitrary project scripts, no fetch provider tasks. Test malicious URLs/paths and arguments.
3. Harden GitHub CLI login onboarding Windows/macOS (open native terminal safely, Check sign-in), existing signed-in account detection, local app logout (do NOT gh auth logout), offline behavior and account switching. Persistence/restart/corrupt files tests; backup export/import validation and schema migration strategy.
4. One-command authenticated installers: macOS shell / Windows PowerShell. Bootstrap/check official gh; get latest RiftTask release assets via gh. Architecture detection; SHA256 manifest validation; user-local app installation; no admin unless prerequisite package manager needs it. Document unsigned binaries/Apple notarization limitations. Keep artifacts private. Never claim platform install tested merely because script syntax checked.
5. Add GitHub Actions Windows/macOS build/test/package workflows IF token permits. Existing token lacks workflow scope, so push may fail: do not bypass scope restriction or borrow another OAuth client's ID. If blocked, retain workflow files locally and provide precise owner action/handoff; can push workflows via API only if genuinely permitted by current credential, not as workaround to permission denial.
6. Independent code/security review, UI browser/Electron smoke, dependency audit, packaging checks. Verify remote commits/CI/release exact state after writes. Do not create a release until artifacts genuinely built and tested enough for clearly labeled prerelease. macOS/Windows native tests require platform CI; Linux result cannot prove them.
7. Final report actual repo, install commands only if functional, verified tests, limitations and remaining owner setup.

## Scheduled continuation rules
This file is the durable task home, not persistent memory. At each scheduled pass read it and git status, pick a bounded vertical slice, run tests BEFORE implementation and after, update evidence/state, commit and push only relevant reviewed files, verify remote SHA. Do not stage .github/workflows into push with known missing workflow permission. Keep tasks within scheduler budget; no unattended daemon or recursive cron. Do not invent results or mark blocked features done. Send a short meaningful update; say plainly if blocked. Protect changes from concurrent agent/parent: if an active build lock exists or unexpected uncommitted changes, inspect and do not overwrite.

## Verification so far
- gh auth status succeeded.
- Private repo creation verified via gh repo view.
- Dependencies: current versions looked up in npm registry with system CA; no TLS verification disabled.

## Foundation milestone (historical baseline)
FIRST MILESTONE VERIFIED AND PUSHED: `f79bb520b4c7c4e22da5b544b4387646493e156b` matched private remote main at the start of the first continuation pass.

- Core/domain, account-isolated disk store, gh identity adapter, secure Electron shell, React task UI all implemented.
- Parent final rerun `npm test`: **27 core/shell/service tests + 13 renderer DOM tests passed**, production Vite build passed. This includes a regression observed RED then fixed: external gh account switching cannot redirect an open workspace into another account's storage.
- Parent exercised REAL authenticated `/opt/data/bin/gh api user` -> app identity adapter -> validated sample workspace -> scratch account disk save -> fresh store load: PASS. Scratch directory removed. No tasks written into actual user application data.
- UI includes category/project create/edit, project archive/restore, task CRUD with notes/due/priority/status/Today, search, list/board, loading/error/offline states, explicit ephemeral browser preview.
- Safe repository URL opening is implemented. Native terminal, gitStatus, chooseDirectory, export/import, and launching the gh login onboarding flow are NOT implemented yet; their IPC calls throw clear scheduled-milestone errors, NOT success. UI currently exposes some of these controls and displays the errors: wire them in next passes.
- Native Electron smoke blocked by missing Linux `libgtk-3.so.0`. Parent browser DOM verified the real empty renderer; screenshot capture timed out. UI subagent reports a separate successful preview walkthrough and recorded details in docs/ui-evidence.md; parent has not independently verified that visual screenshot.
- gh default executable resolution currently uses PATH only. Must resolve `/opt/homebrew/bin/gh`, `/usr/local/bin/gh`, Windows standard/winget paths for GUI launch and this host's `/opt/data/bin/gh` safely. Real-auth smoke used explicit gh runner to bypass host PATH ambiguity for that test only.
- npm install succeeded, production-only dependency audit returned zero vulnerabilities. npm 12 blocked `electron-winstaller` install script; review it before packaging instead of blanket enabling scripts. Reproducible lockfile is committed.
- Scheduled job ff747c1cbab3 is enabled for seven six-hour passes, first 2026-10-24 18:57 UTC. This is continuation schedule, not evidence future work completed.

No release, one-command installer, cloud sync, provider issue import, or native Windows/macOS verification yet. Keep work paced; complete remaining ordered items during scheduled passes.

## Current continuation status — 2026-10-24, first scheduled pass (historical)
- Completed a bounded native-integration slice: the existing Choose directory UI now invokes Electron's directory-only dialog; cancellation returns null. Trusted sender/arity rules still apply.
- Check Git status now explicitly displays a saved project's local branch and changed-entry count. Resolves directory only from persisted active-account data using a validated project ID, never renderer shell text or a renderer-selected account/path. No automatic status polling, fetch, remote provider issues/tasks or scripts.
- Git runner strips inherited GIT_* overrides, disables optional index locks, fsmonitor and all configured clean/process filter drivers, ignores submodule internals, uses argument arrays/shell:false, and caps time/output. Counts porcelain entries (untracked directory = one entry); disabled filters may conservatively report changes that a normal configured clean filter would normalize away.
- Independent review identified a real clean-filter execution risk. Reproduced RED with an equal-size changed tracked file, fixed and observed GREEN; follow-up read-only review found no blockers. Also fixed late Git success/error leakage across project switches via RED/GREEN renderer tests. See docs/native-evidence.md and docs/ui-git-evidence.md.
- Parent final verification: `npm test` **34 core/shell/service/native tests + 15 renderer tests passed**; `npm run build` passed; changed desktop modules passed `node --check`; `git diff --check` clean. Real Git fixture integration ran on Linux; directory dialog testing uses injected Electron, NOT native GUI execution.
- Repository visibility rechecked PRIVATE. Private main push/readback is verified after committing this slice; see the run's delivery report for the exact SHA. No workflows, releases or auth changes in this pass.
- Next bounded slice: native terminal launch from persisted project path with hostile argument/path tests. Then gh GUI executable discovery + login onboarding, backup export/import, authenticated installers and Windows/macOS CI/package verification as ordered above.
- Known blockers unchanged: host missing GTK prevents real Electron smoke; Windows/macOS not available here; token lacks workflow scope (do not stage/push workflow changes or bypass permission). No functional installer/release yet. Disk remained 18 GB free at pass start.

## Current continuation status — 2026-10-25, native terminal slice
- Open terminal now dispatches through trusted IPC and the active account's persisted project ID/path. Rejects extra command arguments, renderer paths as IDs, missing projects, unavailable/non-directory paths, NUL/CR/LF, disconnected and switched accounts.
- Added `desktop/terminal.cjs`: macOS Terminal via opaque `/usr/bin/open` arguments (10-second launcher timeout), Windows system PowerShell with no profile/command text and persisted cwd, Linux `/usr/bin/x-terminal-emulator` with persisted cwd. No project script or provider task fetch.
- Linux/Windows check early failures for 300 ms before detaching; success acknowledges startup, not confirmed visible window or future process health. Native execution remains unverified. Windows PowerShell is deliberately used rather than relying on Windows Terminal being installed.
- Strict RED/GREEN cycles and independent review recorded in `docs/terminal-evidence.md`. Review identified and regression-tested immediate nonzero terminal exit incorrectly reporting success; fixed, follow-up review approved.
- Final `npm test`: **39 core/native/integration + 15 renderer passed**. Production Vite build, changed-module syntax checks, and whitespace check passed. Repository rechecked PRIVATE; push/readback recorded in the run delivery. Disk 18 GB free at pass start.
- Next bounded slice: gh GUI executable discovery and native login onboarding with Check sign-in, then validated backup export/import. Native directory/Git/terminal implementation is now present but Windows/macOS runtime smoke is still mandatory before claiming platform support verified.
- Remaining: backup/restore and migration strategy, login onboarding hardening, authenticated one-command installers, native packaging/CI and final acceptance/security review. GTK/native platform/workflow-scope blockers remain unchanged. No release or functional installer yet.

## Current continuation status — 2026-10-25, GUI gh discovery slice
- Completed the executable-discovery portion of login hardening: default auth now checks official gh installation locations when GUI PATH cannot find gh. PATH stays first; macOS Homebrew Intel/Apple Silicon paths, Windows system/per-user/WinGet paths, Linux system and absolute HOME/bin paths are covered.
- Only ENOENT triggers another installation candidate. Auth/permission/network errors stop discovery; args, shell:false and bounded process options are preserved. No native-terminal login launch or auth changes performed.
- Strict RED/GREEN evidence for discovery/platform selection/default auth integration, additional safety regressions, and independent review (passed, no blockers) are in `docs/gh-discovery-evidence.md`.
- Final `npm test`: **50 core/native/integration + 15 renderer passed**, no failures/skips; production build, changed desktop syntax and whitespace checks passed. Live default auth runner (no injected runner) found installed gh and verified actual identity without cache/workspace writes or printing account details. Repo rechecked PRIVATE; 18 GB free before build.
- Next bounded slice: native-terminal `gh auth login --hostname github.com` onboarding with safe executable/path handling and Check sign-in retry, preserving strict verification and app-only logout. Discovery is now in `desktop/gh.cjs`; do not regress to PATH-only launch. Then validated backup export/import with current-workspace backup and migration policy.
- Still unfinished: login-terminal launch, backup/restore, authenticated installers, Windows/macOS package/runtime checks, CI and final acceptance/security audit. No release/functional installation command yet. Native platform access, GTK and workflow-scope blockers remain; do not bypass permissions or claim Linux mocks prove Windows/macOS execution.
