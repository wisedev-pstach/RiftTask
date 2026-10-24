# Native integration slice — directory picker and explicit local Git status

## Scope and boundaries

First scheduled continuation, 2026-10-24. Only RiftTask source and scratch fixture repositories were changed. Initial `git status --short` was empty; local main and remote main both resolved to `f79bb520b4c7c4e22da5b544b4387646493e156b`. `gh auth status` succeeded; repository view returned PRIVATE. Persistent volume had 18 GB available.

Implemented:
- Existing project directory chooser now calls Electron's directory-only dialog, parented to the current window. Cancellation returns null. Injected Electron test exercises main -> trusted IPC -> dialog -> result.
- Explicit project-header Check Git status action, never automatic on render/navigation. Main validates project ID, rechecks account binding, loads the active account's persisted workspace, and resolves the project path there.
- Local Git status via execFile argument arrays, shell:false, 10-second timeout per invocation, 4 MiB output cap. No fetch/provider calls or issue/task imports. Strip inherited GIT_* overrides; disable optional locks, fsmonitor, untracked cache and clean/process filters; ignore submodule internals. NUL-delimited porcelain v2 handles rename originals, filenames containing newlines, detached/unborn branches and changed entries.
- Missing Git/nonrepository/unavailable paths give sanitized actionable errors. Does not disclose command stderr. Renderer suppresses stale results/errors after switching projects/workspaces. See ui-git-evidence.md for renderer RED/GREEN.

Changed entry count follows porcelain: an untracked directory counts as one entry. Disabling filters may report a change normal filtered Git status would normalize away. Ignoring submodule internals means their internal dirtiness is not included. These are deliberate safety tradeoffs.

## Actual RED / GREEN commands

1. Baseline `npm test && npm run build`: 27 core + 13 renderer tests passed; Vite production build passed.
2. Wrote real-Git trusted-IPC integration test first. `node --test tests/native-git.test.cjs`: **1 failed**, error `gitStatus is not yet available. Scheduled for the native-integration milestone.` Implemented main-only runner/service dispatch. `node --test tests/native-git.test.cjs tests/ipc.test.cjs`: **8 passed**.
3. Wrote directory dialog test first. `node --test --test-name-pattern=chooseDirectory tests/ipc.test.cjs`: **1 failed**, error `chooseDirectory is not yet available...`. Implemented dialog/IPC wiring. `node --test tests/ipc.test.cjs tests/native-git.test.cjs`: **9 passed**.
4. Expanded existing-behavior coverage with scratch Git repositories: staged rename counted once, detached/unborn branches, hostile literal path characters, malformed project IDs, missing/non-directory/relative/control-character paths, nonrepo error, disconnected/switched-account rejection before workspace read, inherited Git redirection and configured fsmonitor not executed. These passed without additional production behavior changes.
5. Independent review found clean/process filters could run arbitrary configured commands even with shell:false. Added regression with configured Node clean filter that writes a marker. First attempt changed file size and passed (Git need not hash an obviously different-size file); corrected to same-size changed content. `node --test --test-name-pattern='clean filter' tests/native-git.test.cjs`: **1 failed**, `true !== false`, `Git status must not execute configured filter commands`. This was a real scratch-only execution, not a fabricated finding.
6. Enumerate filter configuration keys using Git config's NUL-delimited names; override every discovered driver's clean/process to empty and required=false for status. Also ignore submodules to avoid recursive status execution. `node --test tests/native-git.test.cjs`: **6 passed**. Follow-up independent read-only review found no concrete blockers and reran those six tests successfully. Dedicated process/required/global/include filter fixture tests remain possible future coverage; not claimed tested independently.
7. Parent independently reran final `npm test && npm run build && node --check desktop/git.cjs && node --check desktop/service.cjs && node --check desktop/ipc.cjs && node --check desktop/main.cjs && git diff --check`: **exit 0**. Node: **34 tests, 34 pass, 0 fail**. Renderer: **15 passed**. Vite: **16 modules transformed, built in 135ms**. Syntax and whitespace checks emitted no errors.

## Review

Read complete tracked diff and new Git module/tests. Independent review checked the slice; filter blocker fixed test-first and re-reviewed without blockers. Follow-ups from review: stale Git errors fixed test-first by UI agent; newline rename fixture uses a Windows-compatible filename on win32. Source security regex scan (`*.cjs`/`*.jsx`) found zero hardcoded credential assignments, shell:true/os.system/shell=True or eval patterns. An inline Python scan and execute_code were blocked by unattended execution policy; used the normal source search tool instead, without changing approval settings. No credentials, generic shell bridge, renderer Node imports, automatic remote fetching or external writes added.

## Not verified / not delivered

- Dialog wiring uses injected Electron. No claim a real GUI dialog opened on this container.
- Native Electron still blocked by missing libgtk-3.so.0; Windows/macOS execution unavailable. Fixture tests ran on Linux only.
- Terminal integration, gh GUI path discovery/login onboarding, backup export/import, installers, native CI packages and release remain unfinished. Token lacks workflow scope; no workflow changes attempted in this slice.
- No release publication, auth revocation, credentials changes, external deployment or recursive scheduling.
