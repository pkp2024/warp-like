#!/usr/bin/env bash
set -euo pipefail

REPO="pkp2024/termpad"
APP_NAME="termpad"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

info()  { echo -e "${BLUE}[*]${NC} $1"; }
ok()    { echo -e "${GREEN}[✓]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1" >&2; exit 1; }

command -v curl >/dev/null || error "curl is required but not installed."

OS="$(uname -s)"
case "$OS" in
  Linux)  ;;
  Darwin) ;;
  *)      error "Unsupported OS: $OS. On Windows use the PowerShell installer instead." ;;
esac

info "Fetching latest release from GitHub..."
# Use redirect URL — no API rate limit
LATEST_URL="https://github.com/${REPO}/releases/latest"
VERSION=$(curl -sL -o /dev/null -w '%{url_effective}' "$LATEST_URL" | grep -o 'v[0-9][^/]*$')
[ -n "$VERSION" ] || error "Could not determine latest version."

if [ "$OS" = "Linux" ]; then
  APPIMAGE_NAME="Termpad-${VERSION#v}.AppImage"
  DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${VERSION}/${APPIMAGE_NAME}"

  INSTALL_DIR="$HOME/.local/bin"
  DESKTOP_DIR="$HOME/.local/share/applications"
  mkdir -p "$INSTALL_DIR" "$DESKTOP_DIR" "$HOME/.local/share/icons"

  info "Installing Termpad ${VERSION} (Linux)..."
  APPIMAGE_PATH="$INSTALL_DIR/${APP_NAME}.AppImage"
  LIB_DIR="$HOME/.local/lib/${APP_NAME}"
  curl -fsSL --progress-bar "$DOWNLOAD_URL" -o "$APPIMAGE_PATH"
  chmod +x "$APPIMAGE_PATH"

  # Try to run directly with FUSE; if unavailable, extract instead (no sudo needed)
  HAS_FUSE=false
  if ldconfig -p 2>/dev/null | grep -q libfuse.so.2; then
    HAS_FUSE=true
  fi

  if [ "$HAS_FUSE" = true ]; then
    ln -sf "$APPIMAGE_PATH" "$INSTALL_DIR/${APP_NAME}"
    EXEC_CMD="${APPIMAGE_PATH} --no-sandbox"
    ICON_PATH="${APP_NAME}"
  else
    info "FUSE not available — extracting AppImage (no sudo needed)..."
    rm -rf "$LIB_DIR"
    mkdir -p "$HOME/.local/lib"
    cd "$INSTALL_DIR" && "$APPIMAGE_PATH" --appimage-extract >/dev/null && mv squashfs-root "$LIB_DIR"
    # AppRun needs APPDIR set explicitly when invoked outside a FUSE mount
    cat > "$INSTALL_DIR/${APP_NAME}" <<WRAPPER
#!/bin/bash
export APPDIR="$LIB_DIR"
exec "\$APPDIR/AppRun" --no-sandbox "\$@"
WRAPPER
    chmod +x "$INSTALL_DIR/${APP_NAME}"
    EXEC_CMD="${INSTALL_DIR}/${APP_NAME}"
    ICON_PATH="${LIB_DIR}/${APP_NAME}.png"
  fi

  cat > "$DESKTOP_DIR/${APP_NAME}.desktop" <<EOF
[Desktop Entry]
Name=Termpad
Comment=A desktop terminal profile launcher
Exec=${EXEC_CMD}
Icon=${ICON_PATH}
Type=Application
Categories=Utility;TerminalEmulator;
StartupNotify=true
EOF

  if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
  fi

  # Nautilus "Open in Termpad" context menu script
  NAUTILUS_SCRIPTS="$HOME/.local/share/nautilus/scripts"
  mkdir -p "$NAUTILUS_SCRIPTS"
  cat > "$NAUTILUS_SCRIPTS/Open in Termpad" <<'SCRIPT'
#!/usr/bin/env bash
if [ -n "$NAUTILUS_SCRIPT_SELECTED_FILE_PATHS" ]; then
  DIR=$(echo "$NAUTILUS_SCRIPT_SELECTED_FILE_PATHS" | head -1 | tr -d '\r\n')
  [ -f "$DIR" ] && DIR=$(dirname "$DIR")
else
  DIR=$(python3 -c "import sys, urllib.parse; print(urllib.parse.unquote(sys.stdin.read().strip().replace('file://','')))" <<< "$NAUTILUS_SCRIPT_CURRENT_URI" 2>/dev/null || echo "$HOME")
fi
termpad --cwd "$DIR"
SCRIPT
  chmod +x "$NAUTILUS_SCRIPTS/Open in Termpad"

  if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    echo ""
    echo "  Add this to your ~/.bashrc or ~/.zshrc:"
    echo "    export PATH=\"\$HOME/.local/bin:\$PATH\""
  fi

  echo ""
  ok "Termpad ${VERSION} installed!"
  echo "  App launcher: search for 'Termpad' in your app menu"
  echo "  CLI:          ${APP_NAME}"
  echo "  File manager: right-click a folder → Scripts → Open in Termpad"

elif [ "$OS" = "Darwin" ]; then
  DMG_NAME="Termpad-${VERSION#v}-arm64.dmg"
  DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${VERSION}/${DMG_NAME}"

  info "Installing Termpad ${VERSION} (macOS)..."
  TMP_DMG="$(mktemp /tmp/termpad-XXXXXX.dmg)"
  curl -fsSL --progress-bar "$DOWNLOAD_URL" -o "$TMP_DMG"

  MOUNT_POINT="$(mktemp -d /tmp/termpad-mount-XXXXXX)"
  hdiutil attach "$TMP_DMG" -mountpoint "$MOUNT_POINT" -quiet
  APP_SRC="$(find "$MOUNT_POINT" -maxdepth 1 -name "*.app" | head -1)"
  [ -n "$APP_SRC" ] || { hdiutil detach "$MOUNT_POINT" -quiet; error "No .app found in dmg."; }

  cp -r "$APP_SRC" /Applications/
  hdiutil detach "$MOUNT_POINT" -quiet
  rm -f "$TMP_DMG"

  echo ""
  ok "Termpad ${VERSION} installed to /Applications!"
  echo "  Open it from Launchpad or run: open '/Applications/Termpad.app'"
fi
