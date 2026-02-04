#!/bin/bash
set -euo pipefail

# Build oven-sh/WebKit's JavaScriptCore for iOS
#
# Produces: build/ios-simulator-arm64/{libJavaScriptCore.a, libWTF.a, libbmalloc.a}
#
# Prerequisites:
#   - Xcode with iOS SDK
#   - CMake 3.28+
#   - oven-sh/WebKit cloned at $WEBKIT_SRC (or ../WebKit)

WEBKIT_SRC="${WEBKIT_SRC:-$(cd "$(dirname "$0")/../vendor/WebKit" && pwd)}"
BUILD_DIR="$(cd "$(dirname "$0")/.." && pwd)/build"
PLATFORM="${1:-iphonesimulator}"
ARCH="${2:-arm64}"
IOS_MIN="${3:-16.0}"

if [ "$PLATFORM" = "iphoneos" ]; then
  TARGET="${ARCH}-apple-ios${IOS_MIN}"
  SYSROOT=$(xcrun --sdk iphoneos --show-sdk-path)
else
  TARGET="${ARCH}-apple-ios${IOS_MIN}-simulator"
  SYSROOT=$(xcrun --sdk iphonesimulator --show-sdk-path)
fi

BUILD_OUT="${BUILD_DIR}/${PLATFORM}-${ARCH}"
mkdir -p "$BUILD_OUT"

echo "=== Building JSCOnly for ${PLATFORM} ${ARCH} (iOS ${IOS_MIN}) ==="
echo "WebKit source: $WEBKIT_SRC"
echo "Build output:  $BUILD_OUT"

# Apply iOS patches if not already applied
if ! grep -q "TARGET_OS_IPHONE" "$WEBKIT_SRC/Source/WTF/wtf/posix/OSAllocatorPOSIX.cpp" 2>/dev/null; then
  echo "Applying iOS build patches..."
  cd "$WEBKIT_SRC"
  git apply "$(dirname "$0")/../poc/webkit-patches/ios-build-fixes.patch"
fi

cd "$BUILD_OUT"
cmake "$WEBKIT_SRC/Source" \
  -G Ninja \
  -DPORT=JSCOnly \
  -DCMAKE_SYSTEM_NAME=iOS \
  -DCMAKE_OSX_SYSROOT="$SYSROOT" \
  -DCMAKE_OSX_ARCHITECTURES="$ARCH" \
  -DCMAKE_OSX_DEPLOYMENT_TARGET="$IOS_MIN" \
  -DCMAKE_C_FLAGS="-target $TARGET" \
  -DCMAKE_CXX_FLAGS="-target $TARGET" \
  -DENABLE_JIT=OFF \
  -DENABLE_DFG_JIT=OFF \
  -DENABLE_FTL_JIT=OFF \
  -DENABLE_WEBASSEMBLY=OFF \
  -DUSE_SYSTEM_MALLOC=OFF \
  -DCMAKE_BUILD_TYPE=Release \
  2>&1

cmake --build . --target JavaScriptCore WTF bmalloc -- -j$(sysctl -n hw.ncpu) 2>&1

echo ""
echo "=== Build complete ==="
ls -lh lib/libJavaScriptCore.a lib/libWTF.a lib/libbmalloc.a 2>/dev/null
