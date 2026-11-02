#!/usr/bin/env bash
# RiftTask - One-command installer for macOS and Linux
# Authenticated via official GitHub CLI (gh)
set -euo pipefail

REPO="wisedev-pstach/RiftTask"
APP_NAME="RiftTask"

usage() {
  cat <<EOF
Usage: install.sh [OPTIONS]

One-command installer for RiftTask (macOS and Linux).
Requires official GitHub CLI (gh), git, and Node.js v20+.

Options:
  --check        Inspect environment and prerequisites without installing
  --dry-run      Alias for --check
  --source       Force building from source even if a release asset is available
  --dest <dir>   Specify custom installation directory
  --help, -h     Show this help message
EOF
}

CHECK_ONLY=false
FORCE_SOURCE=false
CUSTOM_DEST=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --check|--dry-run)
      CHECK_ONLY=true
      shift
      ;;
    --source)
      FORCE_SOURCE=true
      shift
      ;;
    --dest)
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
  NPM_VER="$(npm --version)"
  echo "  Node.js: OK ($NODE_VER, npm $NPM_VER)"
else
  echo "  Node.js: NOT FOUND" >&2
  echo "    Error: Node.js and npm are required (v20+ recommended)." >&2
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
  if [[ "$CHECK_ONLY" != "true" ]]; then
    exit 1
  fi
fi

if [[ "$CHECK_ONLY" == "true" ]]; then
  echo ""
  echo "Prerequisite check completed successfully. Ready to install RiftTask."
  exit 0
fi

# Determine source directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR="$(dirname "$SCRIPT_DIR")"
TEMP_BUILD_DIR=""

if [[ -f "$PARENT_DIR/package.json" ]] && grep -q '"name": "rifttask"' "$PARENT_DIR/package.json" 2>/dev/null; then
  BUILD_DIR="$PARENT_DIR"
  echo "Using existing repository directory: $BUILD_DIR"
else
  TEMP_BUILD_DIR="$(mktemp -d -t rifttask-install-XXXXXX)"
  BUILD_DIR="$TEMP_BUILD_DIR"
  echo "Cloning RiftTask into temporary build directory: $BUILD_DIR..."
  gh repo clone "$REPO" "$BUILD_DIR" -- --depth=1
fi

cleanup() {
  if [[ -n "$TEMP_BUILD_DIR" && -d "$TEMP_BUILD_DIR" ]]; then
    rm -rf "$TEMP_BUILD_DIR"
  fi
}
trap cleanup EXIT

cd "$BUILD_DIR"

echo "Building RiftTask from source..."
npm ci --no-audit --no-fund
npm run native:rebuild
npm run build

if [[ "$OS" == "mac" ]]; then
  echo "Packaging macOS application bundle..."
  npx electron-builder --mac --"$ARCH" --dir

  # Locate built .app bundle
  APP_BUNDLE=""
  for candidate in "release/mac-$ARCH/$APP_NAME.app" "release/mac/$APP_NAME.app"; do
    if [[ -d "$candidate" ]]; then
      APP_BUNDLE="$candidate"
      break
    fi
  done

  if [[ -z "$APP_BUNDLE" ]]; then
    echo "Error: Application bundle was not found after packaging." >&2
    exit 1
  fi

  # Determine install location
  if [[ -n "$CUSTOM_DEST" ]]; then
    if [[ "$CUSTOM_DEST" == *.app ]]; then
      TARGET_APP="$CUSTOM_DEST"
    else
      TARGET_APP="$CUSTOM_DEST/$APP_NAME.app"
    fi
  elif [[ -w "/Applications" ]]; then
    TARGET_APP="/Applications/$APP_NAME.app"
  else
    mkdir -p "$HOME/Applications"
    TARGET_APP="$HOME/Applications/$APP_NAME.app"
  fi

  echo "Installing to $TARGET_APP..."
  rm -rf "$TARGET_APP"
  cp -R "$APP_BUNDLE" "$TARGET_APP"

  # Strip quarantine if present
  xattr -d com.apple.quarantine "$TARGET_APP" 2>/dev/null || true

  echo ""
  echo "=== RiftTask installation complete! ==="
  echo "Application installed at: $TARGET_APP"
  echo "Launch it with:"
  echo "  open \"$TARGET_APP\""

elif [[ "$OS" == "linux" ]]; then
  echo "Packaging Linux application..."
  npm run pack

  LINUX_BUNDLE="release/linux-unpacked"
  if [[ ! -d "$LINUX_BUNDLE" ]]; then
    echo "Error: Linux unpacked directory was not found after packaging." >&2
    exit 1
  fi

  TARGET_DIR="${CUSTOM_DEST:-$HOME/.local/share/rifttask}"
  echo "Installing to $TARGET_DIR..."
  rm -rf "$TARGET_DIR"
  mkdir -p "$(dirname "$TARGET_DIR")"
  cp -R "$LINUX_BUNDLE" "$TARGET_DIR"

  # Create command launcher
  LAUNCHER_DIR="$HOME/.local/bin"
  mkdir -p "$LAUNCHER_DIR"
  cat <<LAUNCHER > "$LAUNCHER_DIR/rifttask"
#!/usr/bin/env bash
exec "$TARGET_DIR/rifttask" "\$@"
LAUNCHER
  chmod +x "$LAUNCHER_DIR/rifttask"

  echo ""
  echo "=== RiftTask installation complete! ==="
  echo "Installed at: $TARGET_DIR"
  echo "Launcher created at: $LAUNCHER_DIR/rifttask"
fi
