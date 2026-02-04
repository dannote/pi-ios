#!/bin/bash
set -euo pipefail

# Clone and set up all dependencies for pi-terminal.
# Run once after cloning the repo.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="$ROOT/vendor"
mkdir -p "$VENDOR"

# Pinned commits (update these when upgrading)
GHOSTTY_COMMIT="93f12b675c2088aa2376b036262ac0daccc0a313"
WEBKIT_COMMIT="8ab210be702830c306bf8ab406370fc654c07208"

echo "=== Setting up pi-terminal dependencies ==="
echo ""

# --- Ghostty ---
if [ ! -d "$VENDOR/ghostty" ]; then
  echo "Cloning ghostty-org/ghostty..."
  git clone --depth 1 https://github.com/ghostty-org/ghostty.git "$VENDOR/ghostty"
  cd "$VENDOR/ghostty"
  git fetch --depth 1 origin "$GHOSTTY_COMMIT"
  git checkout "$GHOSTTY_COMMIT" 2>/dev/null || true

  echo "Applying iOS Manual backend patch..."
  git apply "$ROOT/poc/webkit-patches/ghostty-ios-manual-backend.patch"
  echo "✓ Ghostty ready"
else
  echo "✓ Ghostty already cloned"
fi

echo ""

# --- oven-sh/WebKit (sparse — only JSCOnly sources) ---
if [ ! -d "$VENDOR/WebKit" ]; then
  echo "Cloning oven-sh/WebKit (sparse, JSCOnly only)..."
  git clone --filter=blob:none --sparse --depth 1 \
    https://github.com/oven-sh/WebKit.git "$VENDOR/WebKit"
  cd "$VENDOR/WebKit"
  git sparse-checkout set \
    Source/JavaScriptCore \
    Source/WTF \
    Source/bmalloc \
    Source/cmake \
    Source/CMakeLists.txt
  git fetch --depth 1 origin "$WEBKIT_COMMIT"
  git checkout "$WEBKIT_COMMIT" 2>/dev/null || true

  echo "Applying iOS build patches..."
  git apply "$ROOT/poc/webkit-patches/ios-build-fixes.patch"
  echo "✓ WebKit ready"
else
  echo "✓ WebKit already cloned"
fi

echo ""
echo "=== Setup complete ==="
echo ""
echo "Next steps:"
echo "  1. Build JSC for iOS:   scripts/build-jsc-ios.sh"
echo "  2. Build Ghostty for iOS: cd vendor/ghostty && zig build -Doptimize=ReleaseFast -Dtarget=aarch64-ios"
echo "  3. Open app/project.yml in Xcode (or run xcodegen)"
