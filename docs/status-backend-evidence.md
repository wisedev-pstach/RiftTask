# Three-status backend migration evidence

## Scope and outcome

Read `AGENTS.md` and the authoritative latest priorities in `docs/BUILD-STATE.md`; loaded the test-driven-development skill. All commands below ran in `/opt/data/projects/RiftTask`.

- Canonical validated task statuses: `backlog`, `doing`, `done`. Exact legacy `next` is accepted only as compatibility input and normalized to `backlog`.
- Schema remains version 1. Validation still checks every task; invalid legacy records reject the workspace rather than being filtered away. Existing unknown-field stripping and required-text trimming are unchanged.
- Known valid task fields survive normalization: id, projectId, title, notes, priority, dueDate, today, createdAt, completedAt. Frozen-input test proves no input mutation; canonical statuses are unchanged and validation is idempotent.
- Sample generator now emits `backlog` directly.
- `desktop/store.cjs` was inspected, not modified: its existing load/save validation boundary already applies the migration consistently.
- Modified only `desktop/core.cjs`, `tests/core.test.cjs`, `tests/store.test.cjs`, and this evidence file. Concurrent renderer edits belong to another agent and were not touched.

## Actual vertical RED/GREEN cycles

### 1. Sample generator

First added `assert.equal(sample.tasks[0].status,'backlog')` to the existing sample behavioral test; no production change yet.

Command: `node --test tests/core.test.cjs tests/store.test.cjs`

RED: exit 1; tests 9, pass 8, fail 1. Failure: `explicit sample generator is valid and never seeds a blank workspace`; actual `'next' !== 'backlog'`.

Minimal implementation: change only the sample task's status literal to `backlog`.

Same command GREEN: exit 0; tests 9, pass 9, fail 0, skipped 0.

### 2. Lossless immutable normalization

Next added only `legacy next normalizes to backlog preserving every known task field without mutation`. It compares the whole expected workspace, including a populated legacy task, and freezes the input task/array/root.

Command: `node --test tests/core.test.cjs tests/store.test.cjs`

RED: exit 1; tests 10, pass 9, fail 1. Whole-workspace deep comparison failed only on actual `status: 'next'` versus expected `status: 'backlog'`.

Minimal implementation: replace the status expression with `choice(x.status==='next'?'backlog':x.status,['backlog','doing','done'])`.

Same command GREEN: exit 0; tests 10, pass 10, fail 0, skipped 0.

## Additional regression/characterization coverage

Added after those completed RED/GREEN cycles; these tests required no further production changes and are not claimed as additional RED cycles:

- Mixed canonical/legacy statuses, idempotence, invalid status spellings/types, validation of other fields on legacy tasks, duplicate rejection.
- Real scratch-disk version-1 JSON written directly (not via the new save validator), with five populated tasks including two `next` tasks, all canonical statuses, an archived project, notes/Unicode, priorities, dates and completion metadata.
- Load returns the exact expected normalized workspace; two independent loads leave original JSON bytes unchanged, with no backup/temp/corrupt file created.
- Explicit save persists all tasks; fresh store and a separate Node process read the exact edited workspace after subsequent saves. This is real disk and process restart, not a filesystem mock or native Electron smoke.
- Invalid legacy reference causes `WORKSPACE_CORRUPT` on load/save without replacing the file or silently deleting tasks.
- Scratch fixtures are removed by test cleanup; real application data is untouched.

## Inspected and tested backup semantics

A valid legacy primary is NOT corruption: load does not rewrite or back it up. On first explicit save, existing `save()` calls `load()` for the previous workspace and serializes that validated result to `workspace.json.bak` before atomically replacing the primary. Consequently the first backup contains **normalized backlog**, not the original raw `next` bytes/formatting; it retains every validated known field/task. The test compares that complete backup to the pre-edit normalized workspace.

This is the existing **rolling backup**, not a dedicated immutable migration archive. A subsequent save replaces `.bak` with the prior saved workspace; the disk test verifies rotation explicitly. No new migration archive or guarantee of permanent original-byte retention has been added. Export/copy the original separately if permanent raw-history retention is required. Existing corrupt-primary recovery semantics remain unchanged and covered by existing tests.

## Final actual verification

Command:

```sh
node --test tests/core.test.cjs tests/store.test.cjs && node --test tests/*.test.cjs && node --check desktop/core.cjs && node --check desktop/store.cjs && git diff --check
```

Result: exit 0.

- Focused suite: **14 tests, 14 pass, 0 fail, 0 skipped** (duration 225.26627 ms).
- Entire CommonJS backend/integration suite: **69 tests, 69 pass, 0 fail, 0 skipped** (duration 1429.350573 ms).
- Both module syntax checks and whitespace check succeeded with no output.

No commit, push, network request, upload, credential/auth change, external write, cloud persistence, or native platform validation was performed by this slice. Cloud persistence remains unimplemented. Renderer/UI verification belongs to the concurrent parent/UI work.
