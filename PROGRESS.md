# Pi Terminal - Progress

## 🎉 Current Status: Interactive REPL Working!

**Bun 1.3.9 running on iOS Simulator with Ghostty terminal**

### What Works
- ✅ Ghostty GPU-rendered terminal (Metal)
- ✅ Bun JavaScript runtime with full Node.js APIs
- ✅ Interactive REPL with input echo
- ✅ Keyboard input (software & hardware keyboards)
- ✅ Control characters (Ctrl+C, etc.)
- ✅ Arrow keys, Escape, Tab
- ✅ Backspace handling
- ✅ Safe area layout (Dynamic Island compatible)
- ✅ `require('os')`, `require('fs')`, `require('crypto')`, etc.
- ✅ `Bun.version`, `Bun.file()`, etc.

### Repository Structure
```
pi-terminal/
├── app/
│   ├── PiTerminal/
│   │   ├── PiTerminalApp.swift      # Main app entry
│   │   ├── TerminalContentView.swift # SwiftUI wrapper
│   │   ├── TerminalView.swift       # Ghostty surface + keyboard
│   │   ├── GhosttyAppManager.swift  # Ghostty runtime
│   │   ├── BunGhosttyBridge.swift   # Bun ↔ Terminal I/O
│   │   └── BridgingHeader.h
│   └── project.yml                  # XcodeGen config
├── vendor/
│   ├── bun/
│   │   ├── lib/                     # Static libraries
│   │   │   ├── libbun.a (4.5GB)
│   │   │   ├── libJavaScriptCore.a
│   │   │   ├── libWTF.a
│   │   │   └── ... (20+ libs)
│   │   └── include/
│   │       └── ios_api.h
│   └── ghostty/
│       └── GhosttyKit.xcframework
└── scripts/
    └── package-bun-ios.sh
```

### Building

1. Clone the Bun fork and build for iOS:
```bash
git clone https://github.com/dannote/bun.git -b ios-port
cd bun
cmake -B build/ios-release -G Ninja \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_SYSTEM_NAME=iOS \
  -DCMAKE_OSX_SYSROOT=iphonesimulator
ninja -C build/ios-release
```

2. Package libraries:
```bash
cd pi-terminal
./scripts/package-bun-ios.sh
```

3. Generate Xcode project:
```bash
cd app
xcodegen generate
```

4. Build and run:
```bash
xcodebuild build -project PiTerminal.xcodeproj -scheme PiTerminal \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro'
```

### Architecture

```
┌─────────────────────────────────────┐
│           PiTerminal App            │
├─────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  │
│  │ TerminalView│  │BunGhostty   │  │
│  │  (Ghostty)  │←→│   Bridge    │  │
│  └─────────────┘  └──────────────┘  │
│         ↑               ↓           │
│    writeOutput()    sendInput()     │
│         ↑               ↓           │
│  ┌─────────────────────────────────┐│
│  │        Unix Pipes              ││
│  │   stdout ←── Bun ──→ stdin     ││
│  └─────────────────────────────────┘│
│         ↑                           │
│  ┌─────────────────────────────────┐│
│  │         libbun.a                ││
│  │    (Bun runtime for iOS)        ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

### Key iOS Modifications in Bun Fork

1. **New `.ios` OS variant** in `Environment.zig`
2. **116 `isMac → isDarwin` changes** for shared Darwin code
3. **JIT-free build** - all JIT/DFG code guarded with `#if ENABLE(JIT)`
4. **Exit behavior** - `bun_ios_exit_callback` instead of `_exit()`
5. **I/O redirection** - `bun_main_with_io()` for custom stdin/stdout

### Next Steps
- [ ] Test on physical iOS device
- [ ] Add just-bash for shell commands
- [ ] Integrate pi-agent
- [ ] App Store submission

## 2026-02-07: FETCH WORKS ON iOS! 🎉

### Issue
`fetch()` was crashing with "Parent loop not set - pointer is null" or "Parent loop data corrupted - tag is invalid" when called on iOS.

### Root Cause
The HTTP Client thread uses a separate uSockets loop, and the libinfo DNS resolution path requires accessing the parent event loop via `loop.internal_loop_data.getParent()`. On iOS, the HTTP thread's loop didn't have a properly configured parent event loop.

### Fix
Skip the libinfo DNS path on iOS and always use the work pool for DNS resolution. The work pool DNS doesn't require the parent event loop.

```zig
// In src/bun.js/api/bun/dns.zig
if (comptime Environment.isDarwin and !Environment.isIOS) {
    // libinfo DNS path - only on macOS
}
// Work pool DNS path - used on iOS and as fallback
```

### Verified Working
- HTTP fetch (`http://httpbin.org/ip`) ✅
- HTTPS fetch (`https://httpbin.org/get`) ✅
- DNS resolution via work pool ✅
