# Explicit project-local Git status — renderer evidence

## Scope

Only `src/App.jsx`, `src/App.test.jsx`, and this evidence file were edited for this slice. Read root `AGENTS.md` and the existing renderer tests first. No commits, pushes, network requests, or auth changes.

The project header now offers **Check Git status**, disabled while saving, in browser preview, or without a local directory. It calls `bridge.gitStatus(project.id)` only after a click. The existing status notice displays the branch and changed-entry count; null explains that the directory is not a Git repository. Rejections use the existing alert. Git notices clear when project/view or workspace changes; a context generation rejects late results after navigation. Non-Git notices are preserved.

One behavioral renderer test covers no automatic call on startup/project selection, explicit ID-only invocation, result display, missing-directory/preview/saving disabling, null, error, project switching and late-result suppression. Native IPC is mocked at the renderer boundary; this does not assert an Electron/native Git smoke test.

## RED — test written before implementation

Working directory: `/opt/data/projects/RiftTask`

Command:
```sh
npm run test:ui -- src/App.test.jsx -t 'checks project-local Git status'
```

Actual failure excerpt (accessible-role/DOM dump omitted):
```text
 ❯ src/App.test.jsx (14 tests | 1 failed | 13 skipped) 207ms
   ❯ workspace (14)
     × checks project-local Git status only on request and keeps results in their project context 206ms

 FAIL  src/App.test.jsx > workspace > checks project-local Git status only on request and keeps results in their project context
TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "Check Git status"

 Test Files  1 failed (1)
      Tests  1 failed | 13 skipped (14)
   Start at  19:02:16
   Duration  894ms (environment 55%, tests 26%, setup 9%, transform 6%, import 4%)
```
Exit code: 1. Missing UI behavior, not a setup failure.

## GREEN and full renderer suite

Initial implementation passed the targeted test (1 passed, 13 skipped; 1.10s) and full renderer suite (14 passed; 2.38s). After narrowing notice clearing to Git notices to preserve backup notices, reran:

```sh
npm run test:ui -- src/App.test.jsx -t 'checks project-local Git status' && npm run test:ui && git diff --check
```

Exact final command output:
```text
npm notice run rifttask@0.1.0 test:ui
npm notice run vitest run src/App.test.jsx -t checks project-local Git status

 RUN  v5.0.5 /opt/data/projects/RiftTask


 Test Files  1 passed (1)
      Tests  1 passed | 13 skipped (14)
   Start at  19:02:55
   Duration  1.14s (environment 42%, tests 38%, transform 8%, setup 7%, import 3%)

npm notice run rifttask@0.1.0 test:ui
npm notice run vitest run

 RUN  v5.0.5 /opt/data/projects/RiftTask


 Test Files  1 passed (1)
      Tests  14 passed (14)
   Start at  19:02:57
   Duration  2.25s (tests 74%, environment 20%, setup 3%, import 1%, transform 1%)
```
Exit code: 0. `git diff --check` emitted no output.

## Issues

An initial discovery command using `python -c` was blocked by the host command guard before execution. Retried using file tools and plain `pwd; git status --short`; no blocker remained. Existing parent-owned desktop/core-test modifications were left untouched.

## Follow-up: suppress late Git status rejection after project switch

Strict TDD: added `does not show a late Git status error after switching projects` before modifying production code. It starts a pending `gitStatus('project')`, switches to Other project, rejects with `Old project Git failed`, waits for the Git status button to become enabled (request finished), and asserts there is no alert.

RED command:
```sh
npm run test:ui -- src/App.test.jsx -t 'does not show a late Git status error after switching projects'
```
Actual output excerpt:
```text
 ❯ src/App.test.jsx (15 tests | 1 failed | 14 skipped) 257ms
     × does not show a late Git status error after switching projects 256ms

 FAIL  src/App.test.jsx > workspace > does not show a late Git status error after switching projects
Error: expect(element).not.toBeInTheDocument()

expected document not to contain element, found <p
  role="alert"
>
  Old project Git failed
</p> instead
 ❯ src/App.test.jsx:59:42

 Test Files  1 failed (1)
      Tests  1 failed | 14 skipped (15)
   Start at  19:06:44
   Duration  1.03s (environment 55%, tests 28%, setup 8%, transform 6%, import 3%)
```
Exit code: 1. This reproduced the stale alert, not a setup failure.

Minimal fix: the existing native-action catch sets an error only when the method is not `gitStatus` or the captured request context still matches. No other native-action behavior or refactoring changed.

GREEN/full renderer command:
```sh
npm run test:ui -- src/App.test.jsx -t 'does not show a late Git status error after switching projects' && npm run test:ui && git diff --check
```
Actual output:
```text
npm notice run rifttask@0.1.0 test:ui
npm notice run vitest run src/App.test.jsx -t does not show a late Git status error after switching projects

 RUN  v5.0.5 /opt/data/projects/RiftTask


 Test Files  1 passed (1)
      Tests  1 passed | 14 skipped (15)
   Start at  19:06:51
   Duration  990ms (environment 51%, tests 28%, setup 9%, transform 8%, import 4%, worker 1%)

npm notice run rifttask@0.1.0 test:ui
npm notice run vitest run

 RUN  v5.0.5 /opt/data/projects/RiftTask


 Test Files  1 passed (1)
      Tests  15 passed (15)
   Start at  19:06:52
   Duration  2.40s (tests 76%, environment 19%, setup 3%, import 1%, transform 1%)
```
Exit code: 0; `git diff --check` emitted no output. Existing in-context Git error coverage also passed in the full suite. Only `src/App.jsx`, `src/App.test.jsx`, and this file were changed for this follow-up. No commits, network/auth actions, or other behavior changes. No issues encountered.
