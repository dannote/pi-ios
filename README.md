# Pi Terminal

Pi coding agent on iOS — Ghostty + Bun + just-bash.

A native iOS terminal that runs [pi](https://github.com/badlogic/pi-mono) with
GPU-accelerated rendering (Ghostty), Node.js compatibility (Bun runtime),
and a virtual shell (just-bash).

## Status

**Bun runtime working on iOS Simulator!** All Node.js APIs functional.

### What works

- **Bun 1.3.9 on iOS** — Full Bun runtime compiled for iOS Simulator (arm64,
  platform 7). All JS features + Node.js APIs working: `require('path')`,
  `require('os')`, `require('fs')`, `require('crypto')`, Buffer, URL, Promise,
  async/await, generators, WeakRef, setTimeout. 60MB binary, zero JIT.
  
- **WebKit JSCOnly** — oven-sh/WebKit @ `515344bc5d65` built with:
  - `ENABLE_JIT=OFF`, `ENABLE_WEBASSEMBLY=ON`
  - `USE_BUN_EVENT_LOOP=ON`, `ENABLE_REMOTE_INSPECTOR=ON`
  - Interpreter-only mode via LLInt

- **Ghostty on iOS** — Metal-rendered terminal with `Manual` I/O backend,
  keyboard input, surface resizing. Builds for arm64 + arm64-simulator.

### What's next

1. Wire Bun into iOS app via C embedding API (`bun_main_thread`, `bun_eval_async`)
2. Integrate with Ghostty terminal for I/O
3. Load just-bash and pi-agent in Bun's iOS runtime

See [PLAN.md](PLAN.md) for the full roadmap.

## Architecture

```
Ghostty (Metal)  ←→  Bridge (Swift)  ←→  Bun Runtime  ←→  Pi Agent
                                               ↕
                                           just-bash
```

- **Ghostty** — terminal rendering and input. No WebView, no xterm.js.
- **Bun** — Full Bun runtime ported to iOS. Provides Node.js API surface.
  Uses oven-sh/WebKit's JSCOnly (interpreter mode, no JIT).
- **just-bash** — TypeScript bash interpreter with 80 commands and a
  virtual filesystem. Replaces `child_process.spawn()` on iOS.
- **Pi** — coding agent in SDK mode with tools adapted for the virtual environment.

## Repository structure

```
pi-terminal/
├── app/                    # iOS app (Swift + XcodeGen)
│   ├── PiTerminal/         # Ghostty terminal wrapper
│   └── project.yml
├── vendor/
│   └── bun/                # Packaged Bun iOS libraries
│       ├── lib/            # Static libraries (libbun.a, libJavaScriptCore.a, etc.)
│       └── include/        # C embedding API headers
├── poc/                    # Proof of concepts
│   └── jsc-ios-demo/       # Early JSC-only demo
├── scripts/
│   ├── build-jsc-ios.sh    # Build JSC for iOS from source
│   └── package-bun-ios.sh  # Package Bun iOS build artifacts
└── PLAN.md                 # Detailed implementation plan
```

## Building

### Prerequisites

- macOS with Xcode 16+
- Bun iOS build (see below)

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

# Test on simulator
xcrun simctl spawn booted build/ios-release/bun-profile.app/bun-profile -e "console.log(require('path').join('/a','b'))"
# Output: /a/b
```

### Package for pi-terminal

```bash
cd ~/Development/pi-terminal
./scripts/package-bun-ios.sh
# Creates vendor/bun/lib/ with ~4.6GB of static libraries
```

## Bun iOS Changes

Key changes to upstream Bun for iOS support:

1. **`OperatingSystem.ios`** — New enum value, treated as Darwin for most codepaths
2. **JIT disabled** — All `ENABLE(JIT)`, `ENABLE(DFG_JIT)` guards respected
3. **iOS sysroot** — `IOS_SYSROOT` env var for Zig `translate-c` to find headers
4. **C embedding API** — `bun_main_thread()`, `bun_eval_async()` for library use
5. **Exit callback** — `bun_ios_exit_callback` intercepts `exit()` for embedding

## App Store viability

- **Zero private Apple APIs** — binary links only UIKit, Foundation, CoreFoundation, libicucore, libc++, libSystem
- **Precedent** — Hermes (React Native), V8 jitless (NativeScript), QuickJS, Lua all ship custom JS/scripting engines on iOS
- **Bun's WebKit fork is 99.77% upstream** — 3,808 lines changed out of 1.63M
