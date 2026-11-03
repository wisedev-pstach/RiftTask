#!/usr/bin/env bash
# RiftTask source-build preview for macOS and Linux (native acceptance pending)
# Authenticated via official GitHub CLI (gh)
set -euo pipefail

REPO="wisedev-pstach/RiftTask"
APP_NAME="RiftTask"

usage() {
  cat <<EOF
Usage: install.sh [OPTIONS]

Source-build preview for RiftTask (macOS and Linux), feat/cloud-persistence.
Requires authenticated official gh, git, Node 24.15+ (24.x) or 26+, npm/npx,
Python 3 and platform C/C++ build tools. Native installation is not verified.

Options:
  --check        Inspect environment and prerequisites without installing
  --dry-run      Alias for --check
  --source       Compatibility flag; this preview always builds fresh source
  --dest <dir>   Exact NEW app directory (macOS: must end in .app)
  --help, -h     Show this help message
EOF
}

CHECK_ONLY=false

CUSTOM_DEST=""

while [[ $# -gt 0 ]]; do
  case "$1" in
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

# Discover gh CLI in standard locations if not already in PATH
if ! command -v gh >/dev/null 2>&1 && [[ "${RIFTTASK_SKIP_CANDIDATE_SEARCH:-0}" != "1" ]]; then
  HOME_DIR="${HOME:-}"
  for candidate in /opt/homebrew/bin/gh /usr/local/bin/gh /opt/data/bin/gh "${HOME_DIR}/bin/gh" "${HOME_DIR}/.local/bin/gh"; do
    if [[ -n "$candidate" && -x "$candidate" ]]; then
      export PATH="$(dirname "$candidate"):$PATH"
      break
    fi
  done
fi

# Prerequisite checks
ERRORS=0

echo "Checking environment for RiftTask installation..."
echo "  OS: $OS ($RAW_OS)"
echo "  Arch: $ARCH ($RAW_ARCH)"

if command -v gh >/dev/null 2>&1; then
  GH_VER="$(gh --version | head -n1)"
  echo "  GitHub CLI (gh): OK ($GH_VER)"
else
  echo "  GitHub CLI (gh): NOT FOUND" >&2
  echo "    Error: GitHub CLI (gh) not found in PATH." >&2
  echo "    Please install gh (e.g. 'brew install gh' on macOS) and run 'gh auth login'." >&2
  ERRORS=$((ERRORS + 1))
fi

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

if [[ "$OS" == "mac" ]]; then
  if xcode-select -p >/dev/null 2>&1 || command -v clang >/dev/null 2>&1; then
    echo "  macOS Build Tools: OK"
  else
    echo "  macOS Build Tools: WARNING - Xcode Command Line Tools recommended for native terminal compilation" >&2
    echo "    Run 'xcode-select --install' if compilation fails." >&2
  fi
fi

if [[ $ERRORS -gt 0 ]]; then
  echo "" >&2
  echo "Installation aborted due to missing prerequisites." >&2
  exit 1
fi

# Check GitHub authentication
if gh auth status >/dev/null 2>&1; then
  echo "  GitHub Authentication: OK"
else
  echo "  GitHub Authentication: NOT AUTHENTICATED" >&2
  echo "    Please run 'gh auth login' to authenticate with your GitHub account." >&2
  exit 1
fi

# --dest is the exact new app directory (a .app bundle on macOS).
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
refuse_existing "$TARGET_DIR"
if [[ "$OS" == "linux" ]]; then refuse_existing "$LAUNCHER_DIR/rifttask"; fi

if [[ "$CHECK_ONLY" == "true" ]]; then
  echo ""
  echo "Tools/authentication/destination check passed. Compilation and native launch remain unverified."
  exit 0
fi

# Always build an isolated fresh copy of the explicit feature ref. Never run
# npm in a user's checkout or reuse its possibly stale release output.
[[ "${TMPDIR:-/tmp}" == /* ]] || { echo 'Error: TMPDIR must be an absolute directory path; set it to an existing absolute directory or unset TMPDIR.' >&2; exit 1; }
TEMP_BUILD_DIR="$(mktemp -d "${TMPDIR:-/tmp}/rifttask-install-XXXXXX")"
cleanup() {
  cd / || return
  rm -rf -- "$TEMP_BUILD_DIR"
}
trap cleanup EXIT
BUILD_DIR="$TEMP_BUILD_DIR/source"
echo "Cloning $REPO at feat/cloud-persistence..."
gh repo clone "$REPO" "$BUILD_DIR" -- --depth=1 --branch feat/cloud-persistence

cd "$BUILD_DIR"

echo "Building RiftTask from source..."
npm ci --no-audit --no-fund
npm run native:rebuild
npm run build

if [[ "$OS" == "mac" ]]; then
  echo "Packaging macOS application bundle..."
  npx --no-install electron-builder --mac --"$ARCH" --dir --publish never

  if [[ "$ARCH" == "arm64" ]]; then
    APP_BUNDLE="release/mac-arm64/$APP_NAME.app"
  else
    APP_BUNDLE="release/mac/$APP_NAME.app"
  fi
  if [[ ! -x "$APP_BUNDLE/Contents/MacOS/$APP_NAME" ]]; then
    echo "Error: matching architecture application executable was not found after packaging." >&2
    exit 1
  fi

  # Never change Gatekeeper/quarantine protections or replace existing apps.
  mkdir -p -- "$(dirname "$TARGET_DIR")"
  mkdir -- "$TARGET_DIR"
  cp -R -- "$APP_BUNDLE/." "$TARGET_DIR/"
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
