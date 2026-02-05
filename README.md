# Pi Terminal

Pi coding agent on iOS — Ghostty + Bun + just-bash.

A native iOS terminal that runs [pi](https://github.com/badlogic/pi-mono) with
GPU-accelerated rendering (Ghostty), Node.js compatibility (Bun runtime),
and a virtual shell (just-bash).

## Status: Bun Runtime Working on iOS! 🎉

**All Node.js APIs tested and working on iOS Simulator:**

| Feature | Status |
|---------|--------|
| Basic JavaScript | ✅ Works |
| `require('path')` | ✅ Works |
| `require('fs')` | ✅ File I/O works |
| `require('crypto')` | ✅ SHA256, etc. |
| `require('os')` | ✅ Returns `darwin`/`arm64` |
| `async/await` | ✅ Works |
| `Buffer` | ✅ Works |
| `URL` | ✅ Works |

### Test Output (iOS Simulator)

```
=== Bun iOS Comprehensive Test ===
Test 1: Basic JS
  2+2 = 4
Test 2: require("path")
  path.join: /a/b/c
Test 3: require("fs")
  File content: Hello from Bun on iOS!
Test 4: require("crypto")
  SHA256("bun"): 08d1082cc8d85a0833da8815ff157467...
Test 5: require("os")
  platform: darwin
  arch: arm64
=== ALL TESTS PASSED ===
```

## Architecture

```
Ghostty (Metal)  ←→  Bridge (Swift)  ←→  Bun Runtime  ←→  Pi Agent
                                               ↕
                                           just-bash
```

- **Ghostty** — terminal rendering and input. No WebView, no xterm.js.
- **Bun** — Full Bun 1.3.9 runtime ported to iOS. Provides Node.js API surface.
  Uses oven-sh/WebKit's JSCOnly (interpreter mode, no JIT).
- **just-bash** — TypeScript bash interpreter with 80 commands and a
  virtual filesystem. Replaces `child_process.spawn()` on iOS.
- **Pi** — coding agent in SDK mode with tools adapted for the virtual environment.

## Building

### Prerequisites

- macOS with Xcode 16+
- Bun iOS build (from fork)

### Bun iOS Build

The Bun iOS port lives in a fork: [`dannote/bun@ios-port`](https://github.com/dannote/bun/tree/ios-port)

```bash
# Clone and build
git clone git@github.com:dannote/bun.git ~/Development/bun
cd ~/Development/bun
git checkout ios-port

# Configure for iOS Simulator
mkdir -p build/ios-release && cd build/ios-release
cmake ../.. -G Ninja \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_TOOLCHAIN_FILE=../../cmake/toolchains/ios-simulator.cmake \
  -DWEBKIT_PATH=$HOME/Development/bun/build/ios-webkit \
  -DUSE_WEBKIT_ICU=ON

# Build (~10 min)
ninja -j$(sysctl -n hw.ncpu)
```

### Package and Build Test App

```bash
# Package Bun libraries into vendor/
cd ~/Development/pi-terminal
./scripts/package-bun-ios.sh

# Build iOS app
cd app
xcodegen generate
xcodebuild build -project BunTest.xcodeproj -scheme BunTest \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -configuration Debug
```

### Run Tests

```bash
# Install and launch on simulator
xcrun simctl install booted ~/Library/Developer/Xcode/DerivedData/BunTest*/Build/Products/Debug-iphonesimulator/BunTest.app
xcrun simctl launch --console booted dev.bun.test
```

## Bun iOS Changes

Key changes to upstream Bun for iOS support:

1. **`OperatingSystem.ios`** — New enum value, treated as Darwin for most codepaths
2. **JIT disabled** — All `ENABLE(JIT)`, `ENABLE(DFG_JIT)` guards respected
3. **iOS sysroot** — `IOS_SYSROOT` env var for Zig `translate-c` to find headers
4. **C embedding API** — `bun_main_thread()`, `bun_eval_async()` for library use
5. **Exit callback** — `bun_ios_exit_callback` intercepts `exit()` for embedding

## App Store Viability

- **Zero private Apple APIs** — binary links only UIKit, Foundation, CoreFoundation, libicucore, libc++, libSystem
- **Precedent** — Hermes (React Native), V8 jitless (NativeScript), QuickJS, Lua all ship custom JS/scripting engines on iOS
- **Bun's WebKit fork is 99.77% upstream** — 3,808 lines changed out of 1.63M

## Next Steps

1. Integrate Ghostty terminal for I/O
2. Load just-bash in Bun's iOS runtime
3. Connect pi-agent in SDK mode
4. Test on physical iOS device
