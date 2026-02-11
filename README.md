# Pi Terminal

A native iOS terminal app that runs the [pi coding agent](https://github.com/mariozechner/pi-mono) with GPU-accelerated rendering.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      iOS App (Swift)                        │
├─────────────────────────────────────────────────────────────┤
│  Ghostty Terminal          │     Bun Runtime               │
│  (Metal rendering)         │     (JSC interpreter)         │
│                            │                               │
│  - GPU text rendering      │     - Node.js APIs            │
│  - ANSI escape sequences   │     - ES modules              │
│  - Keyboard handling       │     - TypeScript              │
└─────────────┬──────────────┴──────────────┬────────────────┘
              │    ghostty_surface_*()      │
              │    bun_start() / pipes      │
              └──────────────┬──────────────┘
                             │
                    ┌────────┴────────┐
                    │  Pi Agent SDK   │
                    │  (bundled JS)   │
                    └─────────────────┘
```

- **Ghostty** — Terminal emulator with Metal rendering. Fork adds iOS-compatible "Manual" backend.
- **Bun** — JavaScript runtime with Node.js compatibility. Fork adds iOS embedding API and simdutf fixes.
- **Pi** — Coding agent running in SDK mode with OpenRouter for LLM access.

## Dependencies

This project depends on two forked repositories:

| Dependency | Fork | Branch | Changes |
|------------|------|--------|---------|
| Ghostty | [dannote/ghostty](https://github.com/dannote/ghostty) | `ios-manual-backend` | Manual termio backend for iOS |
| Bun | [dannote/bun](https://github.com/dannote/bun) | `ios-port` | iOS embedding API, simdutf fixes |

## Building

### Prerequisites

- macOS 14+ with Xcode 16+
- [Zig](https://ziglang.org/) 0.13+ (for Ghostty)
- [Bun](https://bun.sh) (for build scripts)
- [XcodeGen](https://github.com/yonaskolb/XcodeGen)
- CMake and Ninja (for Bun)

### Quick Start

```bash
# Clone this repo
git clone git@github.com:dannote/pi-terminal.git
cd pi-terminal

# Clone and set up dependencies (into ./deps/)
./scripts/setup.sh
```

### 1. Build Ghostty

```bash
cd deps/ghostty
zig build -Doptimize=ReleaseFast -Dtarget=aarch64-ios-simulator

# Copy framework to vendor/
mkdir -p ../../vendor/ghostty
cp -r zig-out/lib/GhosttyKit.xcframework ../../vendor/ghostty/
cd ../..
```

### 2. Build Bun

Building Bun for iOS requires a pre-built WebKit. See the [Bun iOS port documentation](https://github.com/dannote/bun/tree/ios-port/src/ios) for details.

```bash
cd deps/bun

# Build for iOS Simulator
mkdir -p build/ios-release && cd build/ios-release
cmake ../.. -G Ninja \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_TOOLCHAIN_FILE=../../cmake/toolchains/ios-simulator.cmake \
  -DWEBKIT_PATH=$(pwd)/../ios-webkit

ninja
cd ../../../..

# Package libraries into vendor/
./scripts/package-bun-ios.sh
```

### 3. Bundle Pi Agent

```bash
./scripts/bundle-pi.sh
```

### 4. Build iOS App

```bash
cd app
xcodegen generate
open PiTerminal.xcodeproj
```

Build and run on iOS Simulator from Xcode.

### Configuration

Create `config.json` in the app's Documents folder with your OpenRouter API key:

```json
{
  "openrouter_api_key": "sk-or-..."
}
```

## Project Structure

```
pi-terminal/
├── app/
│   ├── project.yml               # XcodeGen project definition
│   └── PiTerminal/               # iOS app source
│       ├── PiTerminalApp.swift
│       ├── GhosttyAppManager.swift
│       ├── BunGhosttyBridge.swift    # Connects Bun ↔ Ghostty
│       ├── TerminalView.swift        # UIView wrapping Ghostty
│       ├── TerminalContentView.swift
│       └── Resources/
│           └── ios-entry.js          # Bun entry point
├── scripts/
│   ├── setup.sh              # Clone dependencies
│   ├── package-bun-ios.sh    # Package Bun libraries
│   └── bundle-pi.sh          # Bundle pi agent
├── deps/                     # Cloned dependencies (gitignored)
│   ├── ghostty/
│   └── bun/
└── vendor/                   # Built artifacts (gitignored)
    ├── bun/
    │   ├── include/
    │   └── lib/
    └── ghostty/
        └── GhosttyKit.xcframework/
```

## License

MIT
