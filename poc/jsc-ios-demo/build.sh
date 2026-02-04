#!/bin/bash
set -euo pipefail

# Build and run the JSC iOS demo on the simulator.
# Expects JSC headers at HEADERS_DIR and libs at LIBS_DIR.

HEADERS_DIR="${HEADERS_DIR:?Set HEADERS_DIR to the JSC include path}"
LIBS_DIR="${LIBS_DIR:?Set LIBS_DIR to the path containing libJavaScriptCore.a}"

SYSROOT=$(xcrun --sdk iphonesimulator --show-sdk-path)
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "Compiling main.mm..."
clang++ -c main.mm \
  -target arm64-apple-ios16.0-simulator -isysroot "$SYSROOT" \
  -std=c++2b -fno-exceptions -fno-rtti -fobjc-arc \
  -I "$HEADERS_DIR" -I "$HEADERS_DIR/JavaScriptCore" \
  -DHAVE_CONFIG_H=1 -DBUILDING_JSCONLY__ -DSTATICALLY_LINKED_WITH_JavaScriptCore=1 \
  -Wno-macro-redefined -o main.o

echo "Compiling stubs.cpp..."
clang++ -c stubs.cpp \
  -target arm64-apple-ios16.0-simulator -isysroot "$SYSROOT" \
  -std=c++2b -o stubs.o

echo "Linking..."
clang++ main.o stubs.o \
  -target arm64-apple-ios16.0-simulator -isysroot "$SYSROOT" -fobjc-arc \
  -L "$LIBS_DIR" -lJavaScriptCore -lWTF -lbmalloc \
  -framework UIKit -framework Foundation -framework CoreFoundation \
  -licucore -lc++ -Wl,-undefined,dynamic_lookup \
  -o BunJSCDemo

echo "Packaging app bundle..."
mkdir -p BunJSCDemo.app
cp BunJSCDemo Info.plist BunJSCDemo.app/
codesign --force --sign - BunJSCDemo.app

echo "Installing on simulator..."
xcrun simctl install booted BunJSCDemo.app
xcrun simctl launch booted com.example.bunjscdemo

echo "Done. Take a screenshot with: xcrun simctl io booted screenshot screenshot.png"
