#!/bin/sh
# Builds dist/Unfold-<version>-apple-silicon.dmg with the install-help window.
# Run from the project folder after `npx tauri build`.
set -e
cd "$(dirname "$0")/.."
V=$(python3 -c "import json;print(json.load(open('src-tauri/tauri.conf.json'))['version'])")
APP=src-tauri/target/release/bundle/macos/Unfold.app
OUT=dist/Unfold-$V-apple-silicon.dmg
codesign --verify --deep --strict "$APP"
W=$(mktemp -d); mkdir "$W/src" "$W/src/.background"
cp -R "$APP" "$W/src/"; ln -s /Applications "$W/src/Applications"
tiffutil -cathidpicheck dmg/bg.png dmg/bg@2x.png -out "$W/src/.background/bg.tiff" 2>/dev/null
for d in /Volumes/Unfold*; do [ -d "$d" ] && hdiutil detach "$d" -force >/dev/null 2>&1 || true; done
hdiutil create -volname Unfold -srcfolder "$W/src" -fs HFS+ -format UDRW -ov "$W/rw.dmg" >/dev/null 2>&1
DEV=$(hdiutil attach -readwrite -noverify -noautoopen "$W/rw.dmg" 2>/dev/null | grep -E '^/dev/' | head -1 | awk '{print $1}')
sleep 1
osascript <<'AS'
tell application "Finder"
  tell disk "Unfold"
    open
    set current view of container window to icon view
    set toolbar visible of container window to false
    set statusbar visible of container window to false
    set the bounds of container window to {200, 100, 860, 656}
    set o to the icon view options of container window
    set arrangement of o to not arranged
    set icon size of o to 128
    set text size of o to 13
    set background picture of o to file ".background:bg.tiff"
    set position of item "Unfold.app" of container window to {180, 150}
    set position of item "Applications" of container window to {480, 150}
    close
    open
    update without registering applications
    delay 1
    close
  end tell
end tell
AS
SetFile -a V "$W/src/.background" 2>/dev/null || true
sync; hdiutil detach "$DEV" >/dev/null 2>&1 || hdiutil detach "$DEV" -force >/dev/null 2>&1
mkdir -p dist/old; [ -f "$OUT" ] && mv "$OUT" "dist/old/$(basename "$OUT" .dmg)-$(date +%Y%m%d%H%M).dmg"
hdiutil convert "$W/rw.dmg" -format UDZO -imagekey zlib-level=9 -o "$OUT" >/dev/null 2>&1
rm -rf "$W"; ls -l "$OUT"
