# Explicit cloud repository creation

## User request
RiftTask should create a cloud storage repository when the user requests it from the app, rather than requiring manual GitHub setup.

## Boundaries
- Explicit Create private repository action in Settings → Cloud, with exact target confirmation.
- Only the currently verified user's own personal namespace; private and initialized with a README.
- Verification, sign-in, a 404, and opening Settings never create repositories.
- Creation is separate from enabling cloud and uploading planning data. Preserve explicit plaintext/history consent and manual sync.
- Use existing official GitHub CLI credentials/scopes; bounded fixed-host transport and sanitized errors.
- Never adopt/overwrite an existing repository silently, retry an uncertain creation blindly, delete created remote data as cleanup, or create in source/project/organization repositories.
- Recheck account generation around native confirmation and network awaits; cancelled or changed identity must not bind/enable the new target.

## Verification
Test-first production transport/runtime/service/IPC/preload/UI paths, independent security review and fresh Settings screenshots with explicitly simulated cloud/native responses. This feature request does not authorize a real repository creation or actual user task upload during development.
