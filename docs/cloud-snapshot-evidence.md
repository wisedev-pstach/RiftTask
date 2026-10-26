# Cloud snapshot preparation — bounded pure slice

Cloud sync is NOT implemented. `desktop/cloud-snapshot.cjs` has no runtime caller, transport, file writes, IPC, credentials, repository selection or authorization. Nothing is uploaded/downloaded. This prepares and validates data only; numeric scope IDs bind an envelope, not consent or ownership. Future main-process callers must independently enforce verified active identity, pinned private dedicated personal repository, explicit opt-in, cancellation/generation and conflict rules.

## Actual strict RED/GREEN evidence

Each tracer bullet ran `node --test tests/cloud-snapshot.test.cjs` before and after production implementation:

1. Projection strips local paths, preserves canonical tasks and leaves caller data unmodified. RED: missing `projectCloudWorkspace` function, 0/1 pass. Implemented validator-based cloned projection. GREEN: 1/1.
2. Positive safe numeric account/repository scope. RED: undefined scope raised an unsanitized TypeError instead of `Invalid cloud scope`. Added explicit validation. GREEN: 2/2.
3. Refuse unsupported fields instead of silently dropping future milestone data. RED: missing expected exception for extra workspace/project/task fields. Canonical strict comparison added. GREEN: 3/3.
4. Restore preparation retains this device's project paths by exact project ID; remote-only projects get empty paths. RED: missing `prepareCloudRestore`. Added pure mapping. GREEN: 4/4.
5. Reject wrong scope, format, extra fields, remote paths, broken references and noncanonical legacy wire status. RED: missing expected exception for wrong account. Added strict envelope comparison and sanitized remote errors. GREEN: 5/5.
6. Bound raw UTF-8 JSON before parsing, and projected envelope, to 512 KiB. RED: oversized valid workspace projection did not throw. Added byte checks. GREEN: 6/6, including exact padded input boundary and multibyte input.

Local persistence still accepts legacy `next` and normalizes it to backlog; cloud helpers require canonical known schema input. Unknown/future fields deliberately block cloud preparation pending an explicit version upgrade instead of silently discarding them. Local limit remains 8 MiB; proposed cloud format limit is deliberately lower at 512 KiB, including envelope. Future transport must cap reads before building an in-memory response, not rely solely on these pure helpers.

## Verification

- Parent `npm test`: 75 core/integration + 27 renderer passed, no failures/skips.
- `npm run build`: passed.
- `node --check desktop/cloud-snapshot.cjs`: passed.
- `git diff --check`: clean.
- Independent read-only reviewer inspected module/tests plus project UI; no blockers. Independently ran 75 + 27 tests and syntax/whitespace checks. Reviewer explicitly distinguished scope binding from transfer permission.
- No actual account workspace, source data repository or remote task store was accessed/changed by snapshot tests. Fixtures are synthetic in memory.

## Next cloud slice

Implement fail-closed consent/repository/identity transfer-decision policy, then manual bounded transport with optimistic concurrency/readback, conflict handling and opt-in UI. Real two-client synthetic remote verification requires explicit authorization; no end-to-end cloud claims before that.
