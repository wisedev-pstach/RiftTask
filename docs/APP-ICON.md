# RiftTask app icon

## Design

Original hand-authored vector: `public/icon.svg` is the source of truth. Inspired by the user's `wisedev-pstach/RiftCode` `build/icon.svg`: the inset 880-unit charcoal rounded tile on a 1024 canvas, lime `#c8ff63`, and diagonal rift establish the shared family. RiftTask replaces RiftCode's R with a bold split checkmark; no letter-path copy or image-generation service was used.

The mark has two solid lime pieces, no small checklist lines, text, or thin outlines. Transparent outer padding preserves the inset tile. `docs/icon-preview.png` shows actual 16/24/32/64/128 pixel rasterizations on light and dark backgrounds (not screenshots of native OS chrome).

## Browser and native integration

- `index.html` declares the SVG favicon. Vite copies `public/icon.svg` to `dist/icon.svg` and rewrites the favicon URL for packaged local loading.
- `desktop/main.cjs` supplies `build/icon.png` to BrowserWindow. The explicit electron-builder `files` list includes that PNG, so the same relative path resolves inside `app.asar`.
- electron-builder uses `build/icon.icns` for macOS, `build/icon.ico` for Windows, and `build/icon.png` for Linux.
- ICO contains 16, 24, 32, 48, 64, 128, and 256 pixel images. ICNS is encoded by Pillow and includes a 1024 pixel representation. The PNG is 1024×1024 RGBA.

## Reproduce and verify

Python is optional developer tooling, not an app or normal build dependency; generated native assets are checked into the source tree. Use a disposable virtual environment:

```sh
python -m venv "$TMPDIR/rifttask-icons"
"$TMPDIR/rifttask-icons/bin/python" -m pip install -r scripts/icon-requirements.txt
"$TMPDIR/rifttask-icons/bin/python" scripts/generate-icons.py
"$TMPDIR/rifttask-icons/bin/python" tests/icon-formats.py
node --test tests/icon.test.cjs
npm run build
npm run pack
RIFT_ICON_ARCHIVE=/absolute/path/to/resources/app.asar node --test tests/icon-archive.integration.test.cjs
```

Verified here: format decoding with Pillow, matching public/native SVGs, explicit packaging configuration, successful Vite build, successful Linux x64 electron-builder directory package, and byte-exact PNG/favicon presence in the real `app.asar`. Inspected the generated contact sheet on light/dark. The ICO/ICNS are real encoded and decoded formats, not proof of Windows/macOS installation, signing, Dock/taskbar rendering, or native OS acceptance. Those require target-OS testing.
