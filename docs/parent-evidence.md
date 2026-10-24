# Parent integration evidence — initial milestone

## Authenticated repository

- `/opt/data/bin/gh auth status` succeeded as `wisedev-pstach`.
- Created private `wisedev-pstach/RiftTask`; `gh repo view --json name,url,isPrivate` confirmed `isPrivate: true`.
- Pushed initial project/config/docs commit `8c8243addbf906cea196b6c8fde8bfffa770a567`.
- `git rev-parse HEAD` and `gh api repos/wisedev-pstach/RiftTask/commits/main --jq .sha` matched exactly.

## Service test-first slices

1. Wrote load/account-isolation tests, ran `node --test tests/service.test.cjs`: RED because `desktop/service.cjs` did not exist.
2. Implemented session/account-ID-derived load: reran same command, 2 passed.
3. Added account-ID-derived save and logout-blocks-save tests, reran: 2 passed / 2 failed because service.save was absent.
4. Implemented save delegation through authenticated account identity: reran, 4 passed / 0 failed.

These tests check orchestration using injected auth/store, not filesystem persistence; filesystem tests belong in backend evidence.

## Dependencies

`npm install --no-audit --no-fund` exited 0 (377 packages). Reproducible package-lock created. Warnings: transitive deprecated rimraf 2, inflight, glob 7, boolean. npm 12 blocked `electron-winstaller@5.4.0` install script by policy; review before Windows packaging, do not blanket approve install scripts.

`npm audit --omit=dev --json` reported zero production dependency vulnerabilities. This is NOT a claim about devDependencies or packaged Electron security; full audit/review remains scheduled.

`node_modules/.bin/electron --version` downloaded the Electron binary but could not execute on this headless host: `libgtk-3.so.0` missing. Therefore native desktop launch is NOT verified. Need Linux GTK/Xvfb dependencies for smoke or actual Windows/macOS CI later; renderer/unit success is insufficient.

Initial node_modules size 466 MB; persistent disk still ~18 GB available. Do not retain redundant installer caches.

## First-milestone integration verification

- Parent reran all tests after merging agent files and after its account-switch regression fix: **27 core/shell/service + 13 renderer tests passed**, no failures. Production `npm run build` passed.
- Added external gh-account-switch regression, saw missing-rejection RED, then bound service's open session to the verified numeric account ID and reran GREEN. A changed CLI identity must be explicitly reconnected rather than writing the open account's tasks into the new identity.
- Actual authenticated gh adapter smoke returned `wisedev-pstach`, numeric ID `111281468`; saved a validated sample in a new scratch account directory, reconstructed the store/service, loaded the sample successfully. Scratch was removed; no actual user workspace was seeded.
- Parent browser opened the real Vite renderer and verified empty-workspace DOM plus explicit preview disclosure. Screenshot attempts timed out; no parent visual screenshot claim.
- Stopped both parent and leftover child Vite preview process groups, then HTTP requests to ports 5173 and 5174 failed as expected. No preview server intentionally remains running.

## Scheduling

Created and listed job `ff747c1cbab3`, seven passes every six hours to this Discord DM. First next_run_at returned `2026-10-24T18:57:12.834630+00:00`. Durable continuation instructions in BUILD-STATE.md. This is scheduling verification, not evidence that a future run completed or delivered.
