# Account cloud persistence — proposed route, NOT implemented

Cloud implementation is the next priority, ahead of installers, login-terminal polish and ancillary work. The three-status compatibility change is now the canonical workspace baseline, not evidence of cloud persistence.

## Selected implementation direction

Use an explicitly user-selected, dedicated PRIVATE GitHub data repository via the installed official `gh` CLI. No paid backend or deployed service. Do not use this app's source repository, project repositories, provider issues/tasks or Gists as storage. No remote data repository has been created, selected, read or written during this pass. This is a design decision, not authorization to create one or upload data.

The app must obtain explicit in-app opt-in before enabling any task-data transfer. Default remains off. Display the verified account, exact target repository, fields being sent, and plaintext/history warnings; require confirmation. A new device independently opts in before downloading workspace data. Do not silently expand OAuth scopes or change shared gh authentication. Handle unavailable permission as a visible blocker.

## Consent, identity and privacy gates

- Store consent/configuration locally under verified numeric account ID, separate from the workspace JSON. Pin both repository numeric ID and owner numeric ID, not only mutable names. Require a dedicated personal repository owned by the active account; refuse public, organization, fork, archived, app-source and project-repository destinations. Repository selection/privacy/identity must be rechecked at transfer time. Remote privacy can change outside the app, so this cannot guarantee private storage forever.
- Use trusted main-process IPC; renderer never receives credentials or arbitrary API endpoints. Use fixed github.com host, validated identifiers, argument arrays and bounded subprocess input/output/time. Upload JSON on stdin, not command-line arguments. Never log bodies, CLI stderr containing sensitive data, or tokens.
- Consent explicitly says task titles, notes, project/category names, repository links and timestamps would be readable by GitHub and anyone granted access to that repository. A private repository is NOT end-to-end encryption. Git history retains prior content; deleting a task or disconnecting locally does not erase remote history. No automatic deletion, repository creation or visibility changes.
- Keep local directory paths device-only. Cloud projection must omit paths (or use empty paths in a separately versioned envelope); applying a remote snapshot retains this device's existing project-ID-to-path mapping and leaves new projects unconfigured. Never use another machine's path to start a terminal. Test this before transport exists.
- Logout cancels further sync work locally and clears in-memory pending operations; does not revoke gh or delete remote data. An already accepted network request cannot be recalled. Recheck account/generation after asynchronous work and before local persistence. Never apply an old account's response to a newly selected account.

## Bounded first implementation slices

1. Pure tested account-scoped consent/configuration and transfer-decision policy, with no network. RED/GREEN: disabled by default, mismatched account/repository, public target, local edits vs remote edits, conflicts and cancellation. No transfer permitted merely because gh is signed in.
2. Tested cloud projection and remote envelope validation (own format version, account/repository IDs, validated canonical workspace, no credentials/local paths). Unknown format versions and oversized input must reject before local save. Preserve all task IDs, statuses, notes, milestone fields when introduced, and device-local mappings.
3. Manual Sync now only. Adapter read/write through injected transport plus real scratch-only adapter tests. Keep last acknowledged remote blob SHA and local base fingerprint per account/repository. Neither changed: no write. Local only changed: write with expected SHA. Remote only changed: show download/replace confirmation, preserve local safety backup. Both changed: explicit conflict, preserve both; no last-write-wins or automatic merge. First sync with content on both sides also conflicts unless identical; do not guess a winner. Serialize operations; no background daemon.
4. Contents API write must use the previously read SHA; on conflict re-read metadata and stop for resolution, never retry as unconditional overwrite. Read back the exact target after a write before marking synced. Network ambiguity remains unsynced until readback reconciles the intended snapshot. A failed read or ambiguous 404 is NOT permission to initialize a new remote file.
5. Opt-in UI, honest off/local/pending/error/conflict/verified state, account switching, restart/offline tests, independent security review. Then explicit authorization for a synthetic-only two-client remote smoke. Actual private task uploads remain forbidden without opt-in. Mocked transport does not prove cross-device sync.

## API constraints verified from GitHub documentation

Source: https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents (retrieved 2026-10-26).

- Create/update Contents API supports private repository files using `repo`-scoped classic/OAuth tokens; workflow scope is additionally required only for workflow-file changes. This design never writes workflow files and does not bypass workflow denials.
- Updates require the current file blob SHA; concurrent changes can conflict. This is a conflict check, not automatic multi-device merging.
- Standard base64 content responses support files up to 1 MB; larger files require raw/object handling. Existing local workspace limit is 8 MiB. The implementation must test bounded raw reads plus separately verified SHA metadata (or deliberately expose a lower documented cloud limit); do not assume the standard JSON content field supports every valid local workspace.
- Provider limits and permission failures remain visible; no claim of unlimited or permanently free hosting. No remote feature or real cross-device verification exists yet.

## Still open

Milestone schema evolution, conflict-resolution UX, corruption salvage and optional encryption need later bounded slices. Cloud should not upload a schema it would silently strip on read. Native Windows/macOS terminal/packaging checks and GitHub workflow permission remain separate blockers, not reasons to postpone the consent-safe cloud implementation.
