# RiftTask — build state

## Mission
Create a private desktop task app for wisedev. Categories → projects → manually maintained tasks. GitHub sign-in; persistent data per account; repository links for GitHub and Azure DevOps; terminal integration; Windows/macOS installation in one command. No provider issue/task imports. No questions; choose sensible defaults. Work incrementally across two days, occasional progress to Discord DM 1562209904591372359. Never publish publicly, use paid services, modify other repos, revoke existing authentication, or expose credentials.

## Environment
- Repository: https://github.com/wisedev-pstach/RiftTask (private; created and read back).
- Local: /opt/data/projects/RiftTask, git main.
- GitHub CLI: /opt/data/bin/gh, authenticated wisedev-pstach; token has repo/read:org/gist, NOT workflow scope. Existing credential file owner-only must stay private. Never print tokens.
- Initial deps installing; backend/UI agents working. Parent must update this file before closing first milestone.
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

## Current status
FIRST MILESTONE VERIFIED LOCALLY; all source is ready for the parent private push (remote SHA checked after push).

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
