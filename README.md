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
- [Bun](https://bun.sh) (for build scripts)
- [XcodeGen](https://github.com/yonaskolb/XcodeGen)

### 1. Build Dependencies

#### Ghostty

```bash
git clone -b ios-manual-backend git@github.com:dannote/ghostty.git ~/Development/ghostty
cd ~/Development/ghostty

# Build for iOS Simulator
zig build -Doptimize=ReleaseFast -Dtarget=aarch64-ios-simulator

# Copy framework to vendor/
mkdir -p ~/Development/pi-terminal/vendor/ghostty
cp -r zig-out/lib/GhosttyKit.xcframework ~/Development/pi-terminal/vendor/ghostty/
```

#### Bun

```bash
git clone -b ios-port git@github.com:dannote/bun.git ~/Development/bun
cd ~/Development/bun

# Build for iOS Simulator (requires pre-built WebKit)
mkdir -p build/ios-release && cd build/ios-release
cmake ../.. -G Ninja \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_TOOLCHAIN_FILE=../../cmake/toolchains/ios-simulator.cmake \
  -DWEBKIT_PATH=$HOME/Development/bun/build/ios-webkit

ninja

# Package libraries
cd ~/Development/pi-terminal
./scripts/package-bun-ios.sh
```

### 2. Bundle Pi Agent

```bash
cd ~/Development/pi-terminal
bun install
bun run src/runtime/bundle-pi.ts
```

### 3. Build iOS App

```bash
cd ~/Development/pi-terminal/app
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
│   └── PiTerminal/           # iOS app source
│       ├── BunGhosttyBridge.swift   # Connects Bun ↔ Ghostty
│       ├── TerminalView.swift       # UIView wrapping Ghostty surface
│       └── Resources/
│           ├── ios-entry.js         # Bun entry point
│           └── pi-ios-bundle.js     # Generated pi agent bundle
├── scripts/
│   └── package-bun-ios.sh    # Extracts Bun libraries for linking
├── src/
│   └── runtime/
│       ├── bundle-pi.ts      # Creates pi-ios-bundle.js
│       └── patch-bundle.ts   # iOS-specific bundle patches
└── vendor/                   # Built dependencies (gitignored)
    ├── bun/
    │   ├── include/
    │   └── lib/              # Static libraries
    └── ghostty/
        └── GhosttyKit.xcframework/
```

## License

MIT
