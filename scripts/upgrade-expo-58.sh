#!/usr/bin/env bash
set -euo pipefail
# Run from repository root on Node 22+ with npm registry access.
# Keep both mobile projects aligned; lockfiles must be updated together with manifests.
for app in mobile mobile-supervisor; do
  echo "== Upgrading $app to Expo SDK 58 =="
  (
    cd "$app"
    npm install expo@^58.0.0
    npx expo install --fix
    npx expo-doctor
    npm run typecheck
    npx expo export --platform android --output-dir /tmp/bcc-expo-"$app"-export
  )
done
echo "Both app upgrades validated locally. Review package.json/package-lock.json diffs before committing."
