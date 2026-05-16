#!/usr/bin/env bash
set -euo pipefail

REPO="pkp2024/warp-like"
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
LATEST=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest")
VERSION=$(echo "$LATEST" | grep -o '"tag_name": *"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"')

if [ "$OS" = "Linux" ]; then
  DOWNLOAD_URL=$(echo "$LATEST" | grep -o '"browser_download_url": *"[^"]*\.AppImage"' | grep -o 'https://[^"]*' | head -1)
  [ -n "$DOWNLOAD_URL" ] || error "Could not find an AppImage in the latest release."

  INSTALL_DIR="$HOME/.local/bin"
  DESKTOP_DIR="$HOME/.local/share/applications"
  mkdir -p "$INSTALL_DIR" "$DESKTOP_DIR" "$HOME/.local/share/icons"

  info "Installing Termpad ${VERSION} (Linux)..."
  APPIMAGE_PATH="$INSTALL_DIR/${APP_NAME}.AppImage"
  curl -fsSL --progress-bar "$DOWNLOAD_URL" -o "$APPIMAGE_PATH"
  chmod +x "$APPIMAGE_PATH"
  ln -sf "$APPIMAGE_PATH" "$INSTALL_DIR/${APP_NAME}"

  cat > "$DESKTOP_DIR/${APP_NAME}.desktop" <<EOF
[Desktop Entry]
Name=Termpad
Comment=A desktop terminal profile launcher
Exec=${APPIMAGE_PATH} --no-sandbox
Icon=${APP_NAME}
Type=Application
Categories=Utility;TerminalEmulator;
StartupNotify=true
EOF

  if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
  fi

  if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    echo ""
    echo "  Add this to your ~/.bashrc or ~/.zshrc:"
    echo "    export PATH=\"\$HOME/.local/bin:\$PATH\""
  fi

  echo ""
  ok "Termpad ${VERSION} installed!"
  echo "  App launcher: search for 'Termpad' in your app menu"
  echo "  CLI:          ${APP_NAME}"

elif [ "$OS" = "Darwin" ]; then
  DOWNLOAD_URL=$(echo "$LATEST" | grep -o '"browser_download_url": *"[^"]*\.dmg"' | grep -o 'https://[^"]*' | head -1)
  [ -n "$DOWNLOAD_URL" ] || error "Could not find a .dmg in the latest release."

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
