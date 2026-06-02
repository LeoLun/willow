#!/usr/bin/env bash
set -euo pipefail

ARCH="${1:?Usage: package-macos.sh <x64|arm64> <version>}"
VERSION="${2:?Usage: package-macos.sh <x64|arm64> <version>}"

if [[ "$ARCH" != "x64" && "$ARCH" != "arm64" ]]; then
  echo "Error: unsupported macOS architecture: $ARCH"
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT/app/work"

APP_NAME="Willow Work"
OUT_DIR="out"
MAKE_DIR="$OUT_DIR/make"
PACKAGE_DIR="$OUT_DIR/${APP_NAME}-darwin-${ARCH}"
APP_BUNDLE="$PACKAGE_DIR/${APP_NAME}.app"
DMG_PATH="$MAKE_DIR/Willow-Work-${VERSION}-${ARCH}.dmg"
ZIP_DIR="$MAKE_DIR/zip/darwin/${ARCH}"
ZIP_PATH="$ZIP_DIR/Willow-Work-${VERSION}-${ARCH}.zip"

echo "=== Packaging macOS ${ARCH} app ==="
mkdir -p "$MAKE_DIR" "$ZIP_DIR"
rm -rf "$PACKAGE_DIR" "$DMG_PATH" "$ZIP_PATH"

pnpm run rebuild:native
pnpm exec electron-forge package --platform=darwin --arch="$ARCH"

if [[ ! -d "$APP_BUNDLE" ]]; then
  echo "Forge package did not produce the expected app bundle; running direct packager fallback..."
  node "$REPO_ROOT/.github/scripts/direct-packager.mjs" "$ARCH"
fi

if [[ ! -d "$APP_BUNDLE" ]]; then
  echo "Expected app bundle was not found at: $APP_BUNDLE"
  echo "Searching for any packaged app for ${ARCH}..."
  FOUND_APP="$(find "$OUT_DIR" -type d -name "*.app" -path "*${ARCH}*" -print -quit || true)"
  if [[ -n "$FOUND_APP" ]]; then
    APP_BUNDLE="$FOUND_APP"
    echo "Using discovered app bundle: $APP_BUNDLE"
  else
    echo "Error: no packaged app bundle was produced for ${ARCH}."
    echo "=== Output directories ==="
    find "$OUT_DIR" -maxdepth 6 -type d -print || true
    echo "=== Output files ==="
    find "$OUT_DIR" -maxdepth 6 -type f -print || true
    exit 1
  fi
fi

echo "Creating DMG: $DMG_PATH"
hdiutil create -volname "$APP_NAME" -srcfolder "$APP_BUNDLE" -ov -format UDZO "$DMG_PATH"

echo "Creating ZIP: $ZIP_PATH"
ditto -c -k --sequesterRsrc --keepParent "$APP_BUNDLE" "$ZIP_PATH"

echo "=== Created macOS ${ARCH} artifacts ==="
ls -lh "$DMG_PATH" "$ZIP_PATH"
