#!/usr/bin/env bash
# RiftTask source-build preview for macOS and Linux (native acceptance pending)
# Anonymous public HTTPS source download; app first use separately requires official gh
set -euo pipefail

REPO="https://github.com/wisedev-pstach/RiftTask.git"
APP_NAME="RiftTask"

usage() {
  cat <<EOF
Usage: install.sh [OPTIONS]

Source-build preview for RiftTask (macOS and Linux), main.
Requires git, Node 24.15+ (24.x) or 26+, npm/npx,
macOS uses shipped node-pty prebuilds; Linux needs Python 3 and C/C++ tools.
Native installation is not verified.

Options:
  --check        Inspect environment and prerequisites without installing
  --dry-run      Alias for --check
  --source       Compatibility flag; this preview always builds fresh source
  --dest <dir>   Exact app directory (macOS: recognized apps can be updated; must end in .app)
  --ref <sha>    Build exactly this full 40-character commit from the public repo
  --help, -h     Show this help message
EOF
}

CHECK_ONLY=false

CUSTOM_DEST=""
SOURCE_COMMIT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ref)
      [[ $# -ge 2 && "$2" =~ ^[0-9a-f]{40}$ ]] || { echo 'Error: --ref requires a full lowercase 40-character commit SHA.' >&2; exit 1; }
      SOURCE_COMMIT="$2"
      shift 2
      ;;
    --check|--dry-run)
      CHECK_ONLY=true
      shift
      ;;
    --source)
      shift
      ;;
    --dest)
      [[ $# -ge 2 && -n "$2" ]] || { echo 'Error: --dest needs a new directory path.' >&2; exit 1; }
      CUSTOM_DEST="$2"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

# Detect OS and Architecture
RAW_OS="$(uname -s)"
case "$RAW_OS" in
  Darwin) OS="mac" ;;
  Linux)  OS="linux" ;;
  *)
    echo "Error: Unsupported operating system: $RAW_OS" >&2
    exit 1
    ;;
esac

RAW_ARCH="$(uname -m)"
case "$RAW_ARCH" in
  arm64|aarch64) ARCH="arm64" ;;
  x86_64|amd64)   ARCH="x64" ;;
  *)
    echo "Error: Unsupported CPU architecture: $RAW_ARCH" >&2
    exit 1
    ;;
esac

# Prerequisite checks
ERRORS=0

echo "Checking environment for RiftTask installation..."
echo "  OS: $OS ($RAW_OS)"
echo "  Arch: $ARCH ($RAW_ARCH)"

if command -v git >/dev/null 2>&1; then
  GIT_VER="$(git --version)"
  echo "  Git: OK ($GIT_VER)"
else
  echo "  Git: NOT FOUND" >&2
  ERRORS=$((ERRORS + 1))
fi

if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
  NODE_VER="$(node --version)"
  # Conservative preview baseline satisfying current Vite/Vitest/jsdom engines.
  if [[ ! "$NODE_VER" =~ ^v([0-9]+)\.([0-9]+)\.([0-9]+)$ ]] ||
     ! (( (BASH_REMATCH[1] == 24 && BASH_REMATCH[2] >= 15) || BASH_REMATCH[1] >= 26 )); then
    echo "Error: unsupported Node.js $NODE_VER; use Node 24.15+ (24.x) or 26+." >&2
    exit 1
  fi
  NPM_VER="$(npm --version)"
  echo "  Node.js: OK ($NODE_VER, npm $NPM_VER)"
else
  echo "  Node.js: NOT FOUND" >&2
  echo "    Error: Node.js and npm are required (Node 24.15+ in 24.x or 26+)." >&2
  echo "    Please install Node.js (e.g. 'brew install node' on macOS)." >&2
  ERRORS=$((ERRORS + 1))
fi

if [[ $ERRORS -gt 0 ]]; then
  echo "" >&2
  echo "Installation aborted due to missing prerequisites." >&2
  exit 1
fi

# --dest is the exact app directory (a .app bundle on macOS).
if [[ "$OS" == "mac" ]]; then
  TARGET_DIR="${CUSTOM_DEST:-$HOME/Applications/$APP_NAME.app}"
  [[ "$TARGET_DIR" == *.app ]] || { echo 'Error: macOS destination must end in .app' >&2; exit 1; }
else
  TARGET_DIR="${CUSTOM_DEST:-$HOME/.local/share/rifttask}"
fi
[[ "$TARGET_DIR" == /* ]] || TARGET_DIR="$PWD/$TARGET_DIR"
LAUNCHER_DIR="$HOME/.local/bin"
refuse_existing() {
  if [[ -e "$1" || -L "$1" ]]; then
    echo "Error: refusing existing destination: $1 (no upgrades in this preview)." >&2
    exit 1
  fi
}
if [[ "$OS" == "mac" ]]; then
  # Fast, dependency-free preflight. Legacy ASAR validation follows npm ci.
  [[ "$TARGET_DIR" != / && "$TARGET_DIR" != "$HOME" && ! -f "$TARGET_DIR" ]] || { echo 'Error: refusing unsafe existing destination.' >&2; exit 1; }
  ancestor="$TARGET_DIR"
  while [[ "$ancestor" != / ]]; do
    [[ ! -L "$ancestor" ]] || { echo "Error: refusing symlink destination/ancestor: $ancestor" >&2; exit 1; }
    ancestor="$(dirname "$ancestor")"
  done
  if [[ -d "$TARGET_DIR" ]]; then echo 'Will update recognized RiftTask installation (identity verification after dependencies are ready).';
  else echo 'Will install RiftTask.'; fi
else
  refuse_existing "$TARGET_DIR"
  refuse_existing "$LAUNCHER_DIR/rifttask"
fi

if [[ "$CHECK_ONLY" == "true" ]]; then
  echo ""
  echo "Tools/destination check passed. Dependency/runtime verification and native launch remain unverified."
  exit 0
fi

# Always build an isolated fresh copy of the explicit main branch. Never run
# npm in a user's checkout or reuse its possibly stale release output.
[[ "${TMPDIR:-/tmp}" == /* ]] || { echo 'Error: TMPDIR must be an absolute directory path; set it to an existing absolute directory or unset TMPDIR.' >&2; exit 1; }
TEMP_BUILD_DIR="$(mktemp -d "${TMPDIR:-/tmp}/rifttask-install-XXXXXX")"
cleanup() {
  cd / || return
  rm -rf -- "$TEMP_BUILD_DIR"
}
trap cleanup EXIT
BUILD_DIR="$TEMP_BUILD_DIR/source"
echo "Cloning $REPO at main..."
git clone --depth=1 --branch main "$REPO" "$BUILD_DIR"

cd "$BUILD_DIR"
if [[ -n "$SOURCE_COMMIT" ]]; then
  git fetch --depth=1 origin "$SOURCE_COMMIT"
  git checkout --detach "$SOURCE_COMMIT"
  [[ "$(git rev-parse HEAD)" == "$SOURCE_COMMIT" ]] || { echo 'Error: source commit mismatch; stopped.' >&2; exit 1; }
  echo "Building exact source commit: $SOURCE_COMMIT"
fi

echo "Building RiftTask from source..."
if [[ "$OS" == "mac" ]]; then
  # Never run node-pty's compile fallback, even with build_from_source inherited.
  npm ci --ignore-scripts --no-audit --no-fund
  DEPLOY_HELPER="$BUILD_DIR/scripts/install-deploy.cjs"
  PRIOR_FINGERPRINT="$(node "$DEPLOY_HELPER" inspect mac "$TARGET_DIR" "$BUILD_DIR" "$HOME" "${TMPDIR:-/tmp}" '')"
else
  npm ci --no-audit --no-fund
fi
npm run native:prepare -- "$ARCH"
npm run build

if [[ "$OS" == "mac" ]]; then
  echo "Packaging macOS application bundle..."
  npx --no-install electron-builder --mac --"$ARCH" --dir --publish never --config.npmRebuild=false

  if [[ "$ARCH" == "arm64" ]]; then
    APP_BUNDLE="release/mac-arm64/$APP_NAME.app"
  else
    APP_BUNDLE="release/mac/$APP_NAME.app"
  fi
  if [[ ! -x "$APP_BUNDLE/Contents/MacOS/$APP_NAME" ]]; then
    echo "Error: matching architecture application executable was not found after packaging." >&2
    exit 1
  fi

  # Same-filesystem staging, recognized-app backup, atomic promotion/rollback.
  # Never change Gatekeeper/quarantine protections or application data.
  node "$DEPLOY_HELPER" deploy mac "$TARGET_DIR" "$BUILD_DIR" "$HOME" "${TMPDIR:-/tmp}" '' "$PRIOR_FINGERPRINT" "$BUILD_DIR/$APP_BUNDLE" "$SOURCE_COMMIT"
  TARGET_APP="$TARGET_DIR"

  echo ""
  echo "=== RiftTask installation complete! ==="
  echo "Application installed at: $TARGET_APP"
  echo "Open the application at the path above using your file manager."

elif [[ "$OS" == "linux" ]]; then
  echo "Packaging Linux application..."
  npx --no-install electron-builder --linux --"$ARCH" --dir --publish never

  if [[ "$ARCH" == "arm64" ]]; then
    LINUX_BUNDLE="release/linux-arm64-unpacked"
  else
    LINUX_BUNDLE="release/linux-unpacked"
  fi
  if [[ ! -x "$LINUX_BUNDLE/rifttask" ]]; then
    echo "Error: Linux executable was not found after packaging." >&2
    exit 1
  fi

  # Reserve a new directory exclusively; never remove a user-selected path.
  mkdir -p -- "$(dirname "$TARGET_DIR")"
  mkdir -- "$TARGET_DIR"
  cp -R -- "$LINUX_BUNDLE/." "$TARGET_DIR/"

  # Create command launcher
  LAUNCHER_DIR="$HOME/.local/bin"
  mkdir -p -- "$LAUNCHER_DIR"
  # Bash printf %q encodes a pathname as one shell word; do not interpolate
  # raw path text into executable shell code. noclobber protects old launchers.
  (
    set -o noclobber
    { printf '#!/usr/bin/env bash\nexec '; printf '%q ' "$TARGET_DIR/rifttask"; printf '"$@"\n'; } > "$LAUNCHER_DIR/rifttask"
  )
  chmod +x "$LAUNCHER_DIR/rifttask"

  echo ""
  echo "=== RiftTask installation complete! ==="
  echo "Installed at: $TARGET_DIR"
  echo "Launcher created at: $LAUNCHER_DIR/rifttask"
fi
