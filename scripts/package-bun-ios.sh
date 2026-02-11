#!/bin/bash
set -euo pipefail

# Package Bun's iOS build artifacts for embedding in the iOS app.
# Creates vendor/bun/ with static libraries and headers.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Allow overriding paths via environment variables
BUN_BUILD="${BUN_BUILD:-$ROOT/deps/bun/build/ios-release}"
WEBKIT_LIBS="${WEBKIT_LIBS:-$ROOT/deps/bun/build/ios-webkit/lib}"

OUT_DIR="$ROOT/vendor/bun"

if [ ! -d "$BUN_BUILD" ]; then
    echo "Error: Bun build not found at $BUN_BUILD"
    echo "Either build Bun first, or set BUN_BUILD environment variable."
    exit 1
fi

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR/lib" "$OUT_DIR/include"

echo "=== Packaging Bun for iOS ==="
echo "Source: $BUN_BUILD"

# Bun's compiled C++ objects + Zig object → libbun.a
echo "Creating libbun.a..."
BUN_OBJECTS=$(find "$BUN_BUILD/CMakeFiles/bun-profile.dir" -name "*.o" -type f | sort)
ar rcs "$OUT_DIR/lib/libbun.a" $BUN_OBJECTS "$BUN_BUILD/bun-zig.o"

# mimalloc (single object)
echo "Copying mimalloc..."
cp "$BUN_BUILD/mimalloc/CMakeFiles/mimalloc-obj.dir/src/static.c.o" "$OUT_DIR/lib/mimalloc.o"

# Sub-project static libraries
echo "Copying sub-libraries..."
for lib in \
  boringssl/libcrypto.a \
  boringssl/libssl.a \
  boringssl/libdecrepit.a \
  brotli/libbrotlicommon.a \
  brotli/libbrotlidec.a \
  brotli/libbrotlienc.a \
  cares/lib/libcares.a \
  highway/libhwy.a \
  libdeflate/libdeflate.a \
  lshpack/libls-hpack.a \
  zlib/libz.a \
  libarchive/libarchive/libarchive.a \
  hdrhistogram/src/libhdr_histogram_static.a \
  zstd/lib/libzstd.a; do
  DEST_NAME=$(basename "$lib")
  cp "$BUN_BUILD/$lib" "$OUT_DIR/lib/$DEST_NAME"
done

# lolhtml (Rust cross-compiled)
cp "$BUN_BUILD/lolhtml/aarch64-apple-ios-sim/release/liblolhtml.a" "$OUT_DIR/lib/liblolhtml.a"

# WebKit static libraries
if [ -d "$WEBKIT_LIBS" ]; then
    echo "Copying WebKit libraries..."
    cp "$WEBKIT_LIBS/libJavaScriptCore.a" "$OUT_DIR/lib/"
    cp "$WEBKIT_LIBS/libWTF.a" "$OUT_DIR/lib/"
    cp "$WEBKIT_LIBS/libbmalloc.a" "$OUT_DIR/lib/"
else
    echo "Warning: WebKit libs not found at $WEBKIT_LIBS"
fi

# Copy iOS embedding header
if [ -f "$ROOT/deps/bun/src/ios/bun_ios.h" ]; then
    cp "$ROOT/deps/bun/src/ios/bun_ios.h" "$OUT_DIR/include/"
fi

echo ""
echo "=== Done ==="
echo "Output: $OUT_DIR/lib/"
du -sh "$OUT_DIR/lib/"
echo ""
echo "Libraries:"
ls -lhS "$OUT_DIR/lib/" | tail -n +2
