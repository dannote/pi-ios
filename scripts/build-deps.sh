#!/bin/bash
# Build all dependencies for Pi iOS from source

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DEPS_DIR="$PROJECT_DIR/deps"
VENDOR_DIR="$PROJECT_DIR/vendor"

mkdir -p "$DEPS_DIR" "$VENDOR_DIR"

echo "Building Pi iOS dependencies..."
echo "==============================="
echo ""
echo "This will:"
echo "  1. Build WebKit/JSC for iOS (C_LOOP interpreter)"
echo "  2. Build Bun for iOS"
echo "  3. Build Ghostty for iOS"
echo ""
echo "Estimated time: ~2 hours"
echo ""

# Build WebKit
echo "[1/3] Building WebKit for iOS..."
cd "$DEPS_DIR"

if [ ! -d "WebKit" ]; then
    git clone https://github.com/ArtSabintsev/WebKit.git
fi

cd WebKit
rm -rf build-ios-device
mkdir build-ios-device && cd build-ios-device

cmake .. \
    -G Ninja \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_SYSTEM_NAME=iOS \
    -DCMAKE_SYSTEM_PROCESSOR=arm64 \
    -DCMAKE_OSX_SYSROOT=iphoneos \
    -DCMAKE_OSX_ARCHITECTURES=arm64 \
    -DCMAKE_OSX_DEPLOYMENT_TARGET=16.0 \
    -DPORT=JSCOnly \
    -DENABLE_STATIC_JSC=ON \
    -DUSE_THIN_ARCHIVES=OFF \
    -DENABLE_JIT=OFF \
    -DENABLE_FTL_JIT=OFF \
    -DENABLE_DFG_JIT=OFF \
    -DENABLE_C_LOOP=ON \
    -DENABLE_SAMPLING_PROFILER=OFF \
    -DENABLE_WEBASSEMBLY=OFF \
    -DENABLE_REMOTE_INSPECTOR=ON

ninja JavaScriptCore

echo "WebKit built successfully!"

# Build Bun
echo ""
echo "[2/3] Building Bun for iOS..."
cd "$DEPS_DIR"

if [ ! -d "bun" ]; then
    git clone https://github.com/dannote/bun.git -b ios-port
fi

cd bun

# Copy WebKit libs
mkdir -p build/ios-webkit-device/lib build/ios-webkit-device/include
cp "$DEPS_DIR/WebKit/build-ios-device/lib/"*.a build/ios-webkit-device/lib/
cp -r "$DEPS_DIR/WebKit/build-ios-device/JavaScriptCore/Headers/"* build/ios-webkit-device/include/
cp "$DEPS_DIR/WebKit/build-ios-device/cmakeconfig.h" build/ios-webkit-device/include/

mkdir -p build/ios-device && cd build/ios-device

cmake ../.. \
    -G Ninja \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_TOOLCHAIN_FILE=../../cmake/toolchains/ios-device.cmake

ninja

echo "Bun built successfully!"

# Package Bun libs
mkdir -p "$VENDOR_DIR/bun-device/lib" "$VENDOR_DIR/bun-device/include"

BUN_OBJECTS=$(find CMakeFiles/bun-profile.dir -name "*.o" -type f | sort)
ar rcs "$VENDOR_DIR/bun-device/lib/libbun.a" $BUN_OBJECTS bun-zig.o

cp ../ios-webkit-device/lib/*.a "$VENDOR_DIR/bun-device/lib/"
cp mimalloc/CMakeFiles/mimalloc-obj.dir/src/static.c.o "$VENDOR_DIR/bun-device/lib/mimalloc.o"
cp -r ../ios-webkit-device/include/* "$VENDOR_DIR/bun-device/include/"

# Copy other libs
for lib in boringssl/libcrypto.a boringssl/libssl.a boringssl/libdecrepit.a \
           brotli/libbrotlicommon.a brotli/libbrotlidec.a brotli/libbrotlienc.a \
           cares/lib/libcares.a highway/libhwy.a libdeflate/libdeflate.a \
           "lolhtml/aarch64-apple-ios/release/liblolhtml.a" lshpack/libls-hpack.a \
           zlib/libz.a libarchive/libarchive/libarchive.a \
           hdrhistogram/src/libhdr_histogram_static.a zstd/lib/libzstd.a; do
    if [ -f "$lib" ]; then
        cp "$lib" "$VENDOR_DIR/bun-device/lib/"
    fi
done

echo "Bun packaged successfully!"

# Build Ghostty
echo ""
echo "[3/3] Building Ghostty for iOS..."
cd "$DEPS_DIR"

if [ ! -d "ghostty" ]; then
    git clone https://github.com/dannote/ghostty.git -b ios-manual-backend
fi

cd ghostty

zig build \
    -Doptimize=ReleaseFast \
    -Dtarget=aarch64-ios \
    --build-file src/build.zig

mkdir -p "$VENDOR_DIR/ghostty/GhosttyKit.xcframework/ios-arm64"
cp zig-out/lib/libghostty.a "$VENDOR_DIR/ghostty/GhosttyKit.xcframework/ios-arm64/libghostty-fat.a"
cp -r zig-out/include "$VENDOR_DIR/ghostty/GhosttyKit.xcframework/ios-arm64/Headers"

echo "Ghostty built successfully!"

echo ""
echo "==============================="
echo "All dependencies built!"
echo "Vendor libraries are in: $VENDOR_DIR"
