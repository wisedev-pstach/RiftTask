# Compact workspace redesign

## Authorized scope
User requested an app icon inspired by their RiftCode repository, a modern minimalist visual refresh, light mode, less text, cloud setup in a dedicated Settings page rather than the task workspace, no repeated cloud text, and substantially tighter sidebar category spacing.

## Direction
Primary surface: operate (compact project/task workspace). Secondary surface: configure (dedicated Settings). Use RiftCode's restrained graphite/lime family without copying its R monogram unchanged; give RiftTask a distinct task/checkmark/rift identity. Avoid marketing headers, oversized project tiles, verbose explanations, decorative statistics, and excessive gaps. Keep light/dark equally complete and accessible; persist appearance locally, not in synced task data.

## Acceptance
- Real application/browser favicon/native packaging icon assets, not only a CSS mark.
- Light, dark and system appearance selection with safe persistence and terminal contrast.
- One Settings screen for appearance, cloud, account and backups; current project/tasks remain focused and terminal sessions are not lost by opening settings.
- Cloud configuration appears only once, stays concise by default and cannot duplicate on repeated navigation/actions. Preserve explicit consent, plaintext/history warning, conflict/download confirmation and corruption reset.
- Reduce category/project row padding/gaps while retaining keyboard focus and usable pointer targets.
- Preserve project-scoped tasks/counts, CRUD, milestones, retained PTY, sign-in, backups and all existing manual-sync safeguards. No real user data/cloud accesses.
- Strict behavioral tests first, full tests/build, independent review, real packaging icon checks, fresh light/dark/settings screenshots inspected by parent. Browser screenshots must state example data/substituted bridge, not native Electron acceptance.

Reference inspected: wisedev-pstach/RiftCode build/icon.svg (charcoal rounded-square, lime R split by a diagonal rift), renderer styles (graphite #0b0d10, accent #c8ff63, compact controls).
