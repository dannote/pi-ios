#!/bin/bash
set -euo pipefail

# Package Bun's iOS build artifacts for embedding in the iOS app.
# Creates vendor/bun/ with static libraries and headers.

BUN_BUILD="${BUN_BUILD:-$HOME/Development/bun/build/ios-release}"
WEBKIT_LIBS="${WEBKIT_LIBS:-$HOME/Development/bun/build/ios-webkit/lib}"
WEBKIT_HEADERS="${WEBKIT_HEADERS:-$HOME/Development/bun/build/ios-webkit/include}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="$SCRIPT_DIR/../vendor/bun"

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR/lib" "$OUT_DIR/include"

echo "=== Packaging Bun for iOS ==="

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
echo "Copying WebKit libraries..."
cp "$WEBKIT_LIBS/libJavaScriptCore.a" "$OUT_DIR/lib/"
cp "$WEBKIT_LIBS/libWTF.a" "$OUT_DIR/lib/"
cp "$WEBKIT_LIBS/libbmalloc.a" "$OUT_DIR/lib/"

echo ""
echo "=== Done ==="
echo "Output: $OUT_DIR/lib/"
du -sh "$OUT_DIR/lib/"
echo ""
echo "Libraries:"
ls -lhS "$OUT_DIR/lib/" | tail -n +2
