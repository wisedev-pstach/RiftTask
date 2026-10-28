# RiftTask — resumed work, 28 October

User explicitly requested continuing RiftTask **today**, after previous seven-pass schedule expired. Do not resume maze/Yosora work under this request. All prior task constraints and latest corrections in AGENTS.md / BUILD-STATE.md remain.

Branch: feat/cloud-persistence, based on verified remote main9ad3c2f. Baseline rerun: 75 core/integration +27 UI tests and production build passed. Disk17GB free. Private repo only, no main merge/release/platform install claims without verification.

## Cloud worker progress — 28 October
- Wired first manual opt-in cloud UI/main/IPC/runtime/transport slice; **94 core + 30 React tests, build, syntax and whitespace checks PASS**. Evidence: `docs/cloud-runtime-evidence.md`. Real scratch-file two-device fixture + Chromium mocked consent/conflict UI verified; screenshots explicitly label mock/no cloud transfer.
- Parent independent review found two blockers after the initial slice: policy-validation/local-edit race and corrupt enabled-value truthiness. Both reproduced RED, fixed GREEN; parent also closed static renamed-project numeric identity exclusion and stale initial UI status/reset recovery. Latest full verification: **98 core/integration + 32 UI tests and production build PASS**. Independent re-review passed with no concrete blocking defects; targeted cloud suites also passed 22/22. Publish only to a private feature branch/draft PR, with exact remote SHA readback; no merge/release or live-cloud acceptance.
- No actual cloud data transfer or datarepo creation/access. External Contents/cross-device verification is pending authorization. A linked GitHub repository with unavailable numeric metadata now blocks cloud safely. Conflict UX remains stop-only; do not claim full cloud or native-platform acceptance.

## Milestone continuation — 28 October
- Cloud slice was already reviewed, committed and pushed on entry: `35c1020670252da60359f8c82219eb23de48d0b3`, private draft PR #1. Clean worktree, no active RiftTask coder; unrelated existing preview left untouched.
- Added project milestone name/color create/edit, task assignment/unassignment and visible labels, Milestones tab with assigned tasks and live done/total. Existing project tiles/counts, three statuses and feature tabs preserved.
- Optional v1 milestone/assignment schema validated and preserved in local store/rolling backup/cloud projection/restore. No old-file eager rewrite. Cloud consent now lists milestone fields. No label deletion UI in this bounded slice.
- Strict RED/GREEN and independent final review: **101 core/integration + 34 UI tests PASS**, production build and whitespace PASS. Current real Chromium example/session-only milestone and board screenshots captured and inspected; zero page errors. See `docs/milestones-evidence.md`.
- No actual remote cloud transfer. Next slice is genuine bottom embedded retained PTY, with independent security/native module/platform checks; not delivered here. Onboarding/installers remain later.
- This pass ends after private feature-branch delivery; no background worker/preview left running. Existing schedule is unchanged. Every continuation must check Warsaw date and skip after **28 October 2026 (23:59 Warsaw cutoff)**; no overnight carryover or recursive scheduling.

## Today's order
1. Complete an actually wired, explicit-opt-in manual cloud persistence flow (not more unused helpers), secure GitHub CLI transport + account/repo/privacy checks + consent UI + conflict-safe local storage + readback. Follow docs/CLOUD-SYNC-DESIGN.md. Existing cloud-snapshot.cjs is available. No paidservice/deployment. Source repository and actual projectrepos must never be cloud-data targets. Never upload actual user task data or create/read/write a remote datarepo on this host without specific authorization; runtime in-app consent governs future user's app operation. Mock tests do not prove real cross-device sync.
2. Once cloud's current slice is reviewed, implement project milestone labels/assignment/Milestones tab with migrations and preservation in cloudsnapshot. Do not race schema/cloud changes across workers.
3. Real bottom-docked PTY terminal retaining per-project live sessions while changing tabs. Existing external launcher does not meet requirement. Native module/process packaging verification required; do not present a fake browser terminal as real execution.
4. Onboarding/installers after above, with explicit known platform/signing/workflow-scope blockers.

## Execution discipline
One coding worker at a time on shared files, strict vertical TDD, actual tests/build, independent security review for cloud/PTY. Parent handles private branch commit/push/PR and remote SHA readback. Feature is NOT complete until all named criteria are verified. Update evidence and BUILD-STATE with what is genuinely delivered versus pending. Current inspected screenshots with each progress update, clearly label example data, browser-only preview and mocked states. No credentials or false cloud-transfer claims.

Today's resumed schedule must be finite and end today Warsaw time; no indefinite token spending or other projects. Honor any subsequent user pause immediately by pausing jobs and stopping active workers before further writes.
