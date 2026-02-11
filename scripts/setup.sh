#!/bin/bash
set -euo pipefail

# Set up dependencies for pi-terminal.
# Run once after cloning the repo.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEPS_DIR="${DEPS_DIR:-$ROOT/deps}"

echo "=== Setting up pi-terminal dependencies ==="
echo "Dependencies will be cloned to: $DEPS_DIR"
echo ""

mkdir -p "$DEPS_DIR"

# --- Ghostty (iOS fork) ---
GHOSTTY_DIR="$DEPS_DIR/ghostty"
if [ ! -d "$GHOSTTY_DIR" ]; then
    echo "Cloning dannote/ghostty (ios-manual-backend branch)..."
    git clone -b ios-manual-backend git@github.com:dannote/ghostty.git "$GHOSTTY_DIR"
else
    echo "✓ Ghostty already at $GHOSTTY_DIR"
fi

# --- Bun (iOS fork) ---
BUN_DIR="$DEPS_DIR/bun"
if [ ! -d "$BUN_DIR" ]; then
    echo "Cloning dannote/bun (ios-port branch)..."
    git clone -b ios-port git@github.com:dannote/bun.git "$BUN_DIR"
else
    echo "✓ Bun already at $BUN_DIR"
fi

echo ""
echo "=== Setup complete ==="
echo ""
echo "Next steps:"
echo ""
echo "1. Build Ghostty for iOS:"
echo "   cd $GHOSTTY_DIR"
echo "   zig build -Doptimize=ReleaseFast -Dtarget=aarch64-ios-simulator"
echo "   mkdir -p $ROOT/vendor/ghostty"
echo "   cp -r zig-out/lib/GhosttyKit.xcframework $ROOT/vendor/ghostty/"
echo ""
echo "2. Build Bun for iOS (requires pre-built WebKit - see Bun iOS docs):"
echo "   cd $BUN_DIR"
echo "   mkdir -p build/ios-release && cd build/ios-release"
echo "   cmake ../.. -G Ninja \\"
echo "     -DCMAKE_BUILD_TYPE=Release \\"
echo "     -DCMAKE_TOOLCHAIN_FILE=../../cmake/toolchains/ios-simulator.cmake \\"
echo "     -DWEBKIT_PATH=\$BUN_DIR/build/ios-webkit"
echo "   ninja"
echo ""
echo "3. Package Bun libraries:"
echo "   cd $ROOT"
echo "   BUN_BUILD=$BUN_DIR/build/ios-release ./scripts/package-bun-ios.sh"
echo ""
echo "4. Bundle pi agent:"
echo "   ./scripts/bundle-pi.sh"
echo ""
echo "5. Build iOS app:"
echo "   cd app && xcodegen generate && open PiTerminal.xcodeproj"
