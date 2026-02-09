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

## 2026-02-07: Claude API Works on iOS! 🎉

### Verified
- OpenRouter API with Claude 3.5 Haiku model
- HTTPS POST with JSON body
- Streaming would need testing but basic completions work

### Test Result
```
Testing OpenRouter Claude API...
Status: 200
Model: anthropic/claude-3.5-haiku

Response:
Hello, greetings from iOS device!

✅ Claude API works on iOS!
```

### Summary of Working Features
- ✅ Bun runtime on iOS Simulator
- ✅ JavaScript execution
- ✅ Node.js APIs (dns, net, tls, fs, etc.)
- ✅ HTTP fetch
- ✅ HTTPS fetch  
- ✅ DNS resolution (via work pool)
- ✅ TLS/SSL connections
- ✅ Claude API via OpenRouter
- ✅ Ghostty terminal rendering
- ✅ Keyboard input handling

### Next Steps
1. Create iOS tool implementations (just-bash for bash/grep/find)
2. Bundle pi-agent for iOS
3. Test on physical iOS device

## 2026-02-09: just-bash Works on iOS! 🎉

### Verified
- `just-bash` virtual shell runs perfectly on iOS
- All key commands work:
  - `cat` - file reading
  - `ls` - directory listing
  - `echo` with redirection
  - `jq` - JSON processing
  - `grep` - text search
  - And many more (awk, sed, find, etc.)

### Bundle Size
- just-bash.js: 3.36 MB (bundled with all commands)

### Integration Notes
- just-bash uses in-memory filesystem
- No child_process spawning needed
- Perfect replacement for pi-agent's bash/grep/find tools

### All Core Pi-Agent Capabilities Verified
1. ✅ Bun runtime on iOS
2. ✅ JavaScript execution  
3. ✅ HTTP/HTTPS fetch
4. ✅ Claude API via OpenRouter
5. ✅ just-bash virtual shell

### Next Steps
1. Create iOS-specific tool implementations wrapping just-bash
2. Bundle pi-agent with just-bash for iOS
3. Test on physical iOS device

## 2026-02-09: iOS Tools Module Created and Verified

### Created
- `lib/ios-tools.ts` — iOS-specific tool implementations using just-bash
  - `bashTool()` — Execute shell commands
  - `grepTool()` — Search file contents
  - `findTool()` — Find files by pattern
  - `readTool()` — Read file contents
  - `writeTool()` — Write file contents
  - `lsTool()` — List directory contents
  - `getFilesystem()` — Access just-bash instance directly
  - `resetBash()` — Reset environment (for testing)

### Verified on iOS Simulator
All tools tested and working:
- bash tool: ✅ ls -la output correct
- grep tool: ✅ Found iOS references in files
- find tool: ✅ Found *.ts files
- read tool: ✅ Read file contents
- write tool: ✅ Wrote and verified file
- ls tool: ✅ Full directory listing

### Architecture
- Uses just-bash Bash singleton for persistent in-memory filesystem
- No child_process spawning needed
- Direct replacement for pi-agent's process-spawning tools
- 2.69 MB bundle size (includes just-bash)

### Next Steps
1. Create pi-agent iOS adapter using these tools
2. Bundle pi-agent core with iOS tools
3. Test complete agent workflow on iOS

## 2026-02-09: iOS Agent Module Created

### Created
- `lib/ios-agent.ts` — Full iOS agent implementation using pi-agent-core
  - Uses OpenRouter API for Claude access
  - Tool implementations using just-bash
  - Streaming text support
  - Tool call/result callbacks

### Verified Locally
- Agent creates and reads files ✅
- Agent uses ls, read, grep tools ✅
- Streaming text works ✅
- OpenRouter API calls work ✅

### Verified on iOS Simulator
- Agent-style API call works ✅
- System prompt + user message → Claude response ✅
- Result: `print("Hello, World!")` for Python hello world request

### Current Bundle Sizes
- ios-tools.ts bundle: 2.69 MB (includes just-bash)
- ios-agent.ts bundle: 7.36 MB (includes pi-agent-core, pi-ai, just-bash)

### Architecture Summary
```
iOS App (Swift/UIKit)
    └── Ghostty Terminal (Metal rendering)
    └── Bun Runtime (embedded via libbun.a)
        └── iOS Agent (TypeScript)
            ├── pi-agent-core (Agent class)
            ├── pi-ai (OpenRouter/Claude API)
            └── iOS Tools (just-bash backed)
                ├── bash
                ├── grep
                ├── find
                ├── read
                ├── write
                └── ls
```

### Next Steps
1. Fix bundle loading on iOS (dynamic import issue)
2. Integrate full iOS Agent into app
3. Add interactive REPL mode
4. Test on physical iOS device
