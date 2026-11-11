# Project icons and task progress

## Use

- Choose **Project icon** when creating or editing a project. In 0.3.0+, select a built-in preset or Custom emoji and paste one Unicode emoji; update every syncing client first (0.2.0 rejects custom values). See [PROJECT-CUSTOMIZATION.md](PROJECT-CUSTOMIZATION.md). Built-in symbol IDs are shared between the renderer and validator; older projects use the folder symbol without a data migration. Sidebar, project tile and header use the same selection.
- Use a category's disclosure arrow to hide only its project links. Its separate name button still opens its overview. This device's collapse preferences are scoped to the positive numeric GitHub account ID, safely parsed from `localStorage`; no workspace/cloud writes occur.
- **In progress** replaces Today and lists only `doing` tasks from every active project regardless of due date or legacy pin. **All categories** is the default; the category filter includes categories without projects/tasks and shows an honest empty state. It combines with task search, is UI-only (not synced), resets on account changes and falls back to All categories if a restore/cloud refresh removes the selected category. Archived projects stay excluded until restored. Project names remain visible in task rows. Search includes titles, task notes and progress bodies/links. Existing `today` booleans remain unchanged; their old form control and badge are not shown.
- Workflow order is **Backlog → In progress → In review → Done**, persisted as `backlog`, `doing`, `review`, `done`. Rows, board columns and task forms share this order; project cards show all four counts, including zero. Review is not completed and is excluded from global In progress. Only Done sets `completedAt`; leaving Done clears it. Existing tasks retain their stage and fields; exact legacy `next` still normalizes to backlog.

### 0.2.0 client compatibility

Update **all devices/clients before using In review with cloud sync or shared backups**. Version 0.1.1 does not recognize `review` and will reject such workspaces/snapshots. We deliberately do not map review back to doing or relax unknown-value rejection. The workspace/envelope remains version 1; this application version change adds a known enum value, not a fabricated cloud migration. Existing strict canonical snapshot comparisons, manual-sync consent/conflict checks, safety backups and local image/path projection are unchanged.
- Use a task's **Progress** button to add timestamped updates without changing its existing task description. Write/Preview and selection-aware formatting controls support bold, italic, lists, inline/fenced code and links. Markdown headings also render. Updates appear newest first; deletion requires a second, explicit confirmation.
- URL cards show the hostname and selectable URL, with the full URL in the tooltip and separate Open/Copy buttons. Markdown HTTP(S) links and bare URLs are also explicit-click controls. Nothing fetches link previews or remote Markdown images. Open uses a trusted-main-frame native IPC endpoint; Copy uses the browser clipboard on the user's click.
- Attach a PNG, JPEG or WebP file. Preview/remove it before saving; click a saved thumbnail to enlarge it inside the app. The renderer decodes and re-encodes user-selected raster files locally, without native paths, temporary files, remote downloads or object URLs. Failed saves retain the current draft.

## Optional version-1 fields

No workspace schema-version bump or load-time rewrite (application version is now 0.3.0). All optional fields remain absent in canonical output when absent in input.

```text
projects[].icon?: folder | code | game | rocket | star | leaf | globe | tools | single bounded Unicode emoji (0.3.0+)

tasks[].progress?: [{
  id: safe ID,
  createdAt: UTC ISO timestamp,
  body: literal Markdown string,
  links: [HTTP/HTTPS URL, ...],
  images?: [{id: safe ID, name: string, mime: image/png|image/jpeg|image/webp, dataUrl: base64 raster}],
  imageCount?: integer
}]
```

Entry IDs are unique within a task; image IDs within an entry. New progress/image objects reject unsupported fields instead of silently discarding them. Core validation applies on save and import, not just in the UI.

### Bounds

| Item | Limit |
| --- | --- |
| Entire local canonical workspace | Existing **8 MiB UTF-8 JSON** cap, unchanged |
| Cloud envelope | Existing **512 KiB UTF-8 JSON** cap, unchanged |
| Updates per task | 100 |
| Progress body | 4,000 JavaScript string characters |
| Explicit links per update | 10, each at most 2,048 characters |
| Images per update | 3 |
| Stored image | 256 KiB decoded bytes, strict MIME/base64/signature validation |
| Selected input file | 5 MiB; 40 megapixels decoded maximum |
| Converted image | PNG, longest edge at most 1,280px; further downscaled until under the stored-image cap |
| Image name | 200 characters |

A note, explicit link or image is required. `imageCount` can represent unavailable local-only images after a pull; it is not an image payload. It is bounded 0–3 and cannot be below the number of present images. UTC timestamps must be real dates/times. URLs must start with lowercase `http://` or `https://`, have no userinfo, whitespace, backslashes or control characters. SVG/HTML, remote image URLs and data/file/javascript links are refused. Markdown unsafe links are displayed as inert text; raw HTML is escaped, never executed.

The pinned `marked@18.1.3` lexer (Node >=20, browser build exercised) supplies tokens. The renderer creates only allowlisted React elements; it does not use parser-generated HTML, `dangerouslySetInnerHTML`, eval, syntax highlighters or remote image tags.

## Persistence and privacy

**Local storage:** inline images live in the existing account `workspace.json`. Atomic save, rolling backup, restart, export and import use the same validation and storage path as other tasks. No additional filesystem permissions or attachment directory are introduced. At the workspace cap, the draft remains and an actionable error recommends exporting a backup before removing old entries/images. An image-heavy workspace can reach the total cap well before per-task limits.

**Cloud:** icons, literal progress Markdown, explicit links and an image count are plaintext synced metadata. Image bytes, names, MIME values and attachment IDs are excluded completely, as are existing local directory mappings. Remote payloads containing even an empty `images` field are rejected by strict canonical comparison, not silently accepted/stripped. Exact matching project/task/entry IDs retain this device's images on a pull; different identities never borrow them. The final restored workspace is validated against the local size cap before replacement. A rolling safety backup is still made before a pull. Conflict and Disable do not modify the local workspace or images.

A receiving device shows an honest unavailable-image message when the synced count exceeds its local attachments. Cloud does **not** transfer image binaries. Backup export/import is the portable full-fidelity route. GitHub/repository collaborators can read synced notes/links; history can retain deleted content. Existing destination/privacy/consent/account-generation checks remain in effect.

## Verification and handoff

See [IN-PROGRESS-REVIEW-EVIDENCE.md](IN-PROGRESS-REVIEW-EVIDENCE.md) for the current 0.2.0 follow-up tests, compatibility warning and dark/light 1024/1440 screenshot matrix. See [PROJECT-PROGRESS-EVIDENCE.md](PROJECT-PROGRESS-EVIDENCE.md) for original rich-progress commands, results and screenshot paths. The browser preview uses clearly simulated identity/bridge and example tasks; it is not a native Electron, authenticated account or live-cloud test.

Native owner check on `feat/project-icons-task-progress`: use the existing setup/native-prepare/build/start instructions in [SETUP.md](SETUP.md), then create two categories/projects, choose/edit icons, collapse one category, put a task in each project into In progress, add a formatted note/link/image and restart. Check the progress survives, export/import a backup, then verify explicit URL opening and clipboard access on the target OS. Optional cloud should show text/links/icons but no binary images on another device. Do not use real sensitive data for cloud acceptance.
