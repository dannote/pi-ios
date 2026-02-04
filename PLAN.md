# Pi-on-iOS: Ghostty + Bun + just-bash

## Goal

Run **pi** (coding agent) on iOS inside **Ghostty** (GPU-rendered terminal),
powered by **Bun's JSC** (Node.js compat) with **just-bash** (virtual shell).

No WebView. No xterm.js/hterm. No emulated Linux kernel. Native Metal rendering,
native JS engine, virtual filesystem.

## Architecture

```
┌─────────────────────────────────────────────┐
│  iOS App (Swift)                            │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  Ghostty Surface (Metal)              │  │
│  │  - GPU terminal rendering             │  │
│  │  - VT100/xterm escape sequence parser │  │
│  │  - Manual I/O backend (no pty)        │  │
│  └────────────┬──────────────┬───────────┘  │
│          write_output    surface_text        │
│               │              │               │
│  ┌────────────▼──────────────▼───────────┐  │
│  │  Bridge Layer (Swift)                 │  │
│  │  - Connects Ghostty ↔ Bun stdio      │  │
│  │  - Keyboard accessory bar (iSH-style) │  │
│  │  - Terminal resize → Bun env vars     │  │
│  └────────────┬──────────────┬───────────┘  │
│               │              │               │
│  ┌────────────▼──────────────▼───────────┐  │
│  │  Bun Runtime (oven-sh/WebKit JSC)     │  │
│  │  - JSC interpreter (JIT disabled)     │  │
│  │  - Node.js compat: fs, path, crypto,  │  │
│  │    events, url, os, Buffer            │  │
│  │  - npm package loading                │  │
│  │  - fetch() for LLM API calls          │  │
│  └────────────┬──────────────────────────┘  │
│               │                              │
│  ┌────────────▼─────────────────────────┐   │
│  │  Pi Agent (TypeScript)               │   │
│  │  - pi-ai: LLM providers (fetch)     │   │
│  │  - pi-agent-core: tool loop          │   │
│  │  - pi-coding-agent: SDK mode         │   │
│  │  - pi-tui: GhosttyTerminal adapter  │   │
│  └────────────┬─────────────────────────┘   │
│               │                              │
│  ┌────────────▼─────────────────────────┐   │
│  │  just-bash (TypeScript)              │   │
│  │  - Virtual bash interpreter          │   │
│  │  - In-memory filesystem              │   │
│  │  - 80 commands: grep, sed, find, ... │   │
│  │  - No child_process needed           │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

## Why This Combination Works

### Ghostty vs iSH's approach

iSH renders terminal via **hterm inside a WKWebView**. Every byte travels:
ObjC → JS string escape → WKWebView IPC (cross-process!) → hterm JS parse → DOM render.
Keyboard input returns the same way through WKScriptMessageHandler.

Ghostty renders directly to **Metal** from a native Zig terminal state machine.
Zero IPC, zero DOM, zero JavaScript for rendering. Already has:
- `Manual` backend (`src/termio/Manual.zig`) — designed for iOS, no pty needed
- `GHOSTTY_PLATFORM_IOS` enum — iOS is a first-class platform
- `ghostty_surface_write_output()` — push terminal output programmatically
- `ghostty_surface_text()` — receive keyboard input
- Working iOS builds: 195MB static lib for arm64, 194MB for simulator

### Bun's JSC vs alternatives

| Runtime | Engine | JIT on iOS | Node APIs | npm pkgs | Size |
|---------|--------|-----------|-----------|----------|------|
| Bun JSC | oven-sh/WebKit | No (disabled) | 54+ modules | Yes | ~35MB |
| nodejs-mobile | V8 --jitless | No | Full Node 18 | Yes | ~40MB |
| Hermes | Custom | No | None | No | ~3MB |
| QuickJS | Custom | No | None | No | ~1MB |

Bun's JSC is proven on iOS (our PoC runs all JS features). Pi needs Node.js APIs
(fs, path, crypto, child_process, events) and npm packages — Bun provides both.

### just-bash vs real bash

Pi's `bash` tool currently uses `child_process.spawn()` which needs a real shell.
iOS has no user-accessible shell. just-bash provides:
- Full bash interpreter in TypeScript (no native code)
- 80 commands: grep, sed, awk, find, cat, ls, mkdir, rm, jq, curl, etc.
- In-memory virtual filesystem
- Browser-compatible bundle (no node: dependencies in core)
- `defineCommand()` API for custom tools

Pi's bash tool has a pluggable `BashOperations` interface — swap `spawn()` for
`just-bash.exec()` with zero changes to pi's core.

## Components & Status

| Component | Repo | Status | Work Needed |
|-----------|------|--------|-------------|
| Ghostty iOS | ghostty-ios-app | ✅ Renders, keyboard works | Add accessory bar, bridge layer |
| Ghostty lib | ghostty-ios | ✅ Built for arm64 + simulator | None |
| Bun's JSC iOS | oven-sh/WebKit | ✅ **PoC running on simulator** — 3 libs built, all JS features working, private APIs compile | Build for device (arm64-apple-ios, not just simulator) |
| Bun runtime | oven-sh/bun | 🔶 JSC foundation done, Bun layer not started | Bun's Node compat layer on top of our working JSC |
| Pi agent | pi-mono | ✅ SDK mode exists | Adapt tools for iOS |
| just-bash | vercel-labs/just-bash | ✅ Browser bundle exists | Integrate as bash backend |

## Implementation Plan

### Phase 1: Ghostty Terminal Shell (2 weeks)
**Goal: Ghostty + just-bash = working terminal on iOS**

1. **Keyboard accessory bar** — borrow iSH's design:
   - Tab / Ctrl / Esc buttons + arrow pad
   - `UIKeyCommand` for hardware keyboard (Ctrl+C, arrows, etc.)
   - Caps Lock mapping, Option-as-Meta
   - Smart keyboard traits (no autocorrect, no autocapitalize)

2. **just-bash integration via Bun JSC**
   - Bundle just-bash's browser build into the app
   - Load it in our JSC context (already proven working)
   - Bridge: keyboard input → `Bash.exec()` → terminal output
   - Wire `COLUMNS`/`LINES` from Ghostty surface size

3. **Interactive shell loop**
   - Prompt rendering (PS1)
   - Line editing (readline-like: cursor movement, history, Ctrl+A/E/K/U)
   - just-bash handles the actual command execution
   - Output flows through `ghostty_surface_write_output()`

**Deliverable**: An iOS app where you can type `ls`, `cat`, `grep`, `echo`,
`jq`, etc. in a beautiful GPU-rendered Ghostty terminal.

### Phase 2: Bun Runtime for iOS (4-6 weeks)
**Goal: Full Node.js API compatibility on iOS**

This is the heavy lift. Two approaches, pick one:

#### Option A: Full Bun cross-compile (4-6 weeks)
1. Add `ios` to Bun's `OperatingSystem` enum (`src/env.zig`)
2. Create static library target in `build.zig`
3. Cross-compile all C/C++ deps for arm64-apple-ios:
   - BoringSSL, c-ares, zlib, zstd, libdeflate, brotli, lshpack
4. Stub iOS-incompatible modules:
   - `child_process` → delegate to just-bash
   - `net.createServer()` → not needed for pi
   - TinyCC, shell → remove
5. Build `libbun-ios.a` static library
6. Design C embedding API: `bun_eval(ctx, code)`, `bun_require(ctx, module)`

#### Option B: Minimal Bun node-compat layer on JSC (2-3 weeks)
1. Take Bun's `src/js/node/*.ts` (54 modules, 33K lines)
2. Bundle them for our standalone JSC (no Zig/C++ native layer)
3. Implement critical native parts in C++ against our JSC build:
   - `fs` → iOS sandbox filesystem APIs
   - `crypto` → CommonCrypto / BoringSSL
   - `path` → pure JS (already is in Bun)
   - `Buffer` → Bun's JS implementation + JSC typed arrays
   - `events` → pure JS
   - `os` → UIDevice / sysctl
4. Skip modules pi doesn't need: `child_process`, `net`, `http`, `dgram`,
   `cluster`, `tls`, `dns`, `worker_threads`

**Recommendation**: Option B. Pi only uses `fs`, `path`, `crypto`, `os`,
`events`, `url`, `child_process` (→ just-bash). Option B avoids cross-compiling
Bun's entire Zig toolchain and 15+ C dependencies.

### Phase 3: Pi on iOS (2-3 weeks)
**Goal: Pi coding agent running in Ghostty**

1. **Pi bash tool → just-bash**
   ```typescript
   // Pi's BashOperations interface is already pluggable:
   const iosBashOps: BashOperations = {
     exec: async (command, cwd, { onData, signal, timeout }) => {
       const result = await bash.exec(command, { cwd, timeout });
       onData(Buffer.from(result.stdout + result.stderr));
       return { exitCode: result.exitCode };
     }
   };
   const tools = createCodingTools("/home/user", { bash: { operations: iosBashOps }});
   ```

2. **Pi read/write/edit tools → virtual filesystem**
   - just-bash's `InMemoryFs` as the project filesystem
   - Pi's `ReadOperations`, `EditOperations`, `WriteOperations` are pluggable
   - Map them to the same virtual FS instance

3. **Pi TUI → Ghostty Terminal adapter**
   ```typescript
   // Pi's Terminal interface is already abstract:
   class GhosttyTerminal implements Terminal {
     write(data: string) {
       // → ghostty_surface_write_output()
       nativeBridge.writeToSurface(data);
     }
     start(onInput, onResize) {
       // ← ghostty_surface_text() callback
       nativeBridge.onKeyboardInput = onInput;
       nativeBridge.onResize = onResize;
     }
     get columns() { return ghosttySurfaceSize.columns; }
     get rows() { return ghosttySurfaceSize.rows; }
   }
   ```

4. **Pi AI → fetch() (already works)**
   - `pi-ai` and `pi-agent-core` have zero `node:` imports
   - They use global `fetch()` — available in Bun's JSC
   - API keys stored in iOS Keychain

5. **Pi SDK mode** — use `createAgentSession()` with custom tools and terminal

### Phase 4: Polish (2 weeks)

1. **File management**
   - Document picker for importing/exporting files
   - iCloud Drive integration for persistence
   - Share sheet for sending files from other apps

2. **Session persistence**
   - Pi sessions saved to app container
   - Resume conversations across app launches

3. **iOS integration**
   - Siri Shortcuts: "Ask Pi to..."
   - Background URL session for long API calls
   - Clipboard read/write (already in Ghostty's runtime config)
   - Haptic feedback on command completion

4. **App Store preparation**
   - Remove `-undefined,dynamic_lookup` (provide all stubs properly)
   - Build for arm64-apple-ios (device, not just simulator)
   - Create XCFramework with simulator + device slices
   - Test binary with Apple's `nm`-based private API scanner
   - App Review notes explaining the custom JSC build

## Critical Path

```
Phase 1 ────────┐
(Ghostty + bash) │
2 weeks          │
                 ├──► Phase 3 ──────► Phase 4
Phase 2 ────────┘    (Pi agent)       (Polish)
(Bun/Node APIs)      2-3 weeks        2 weeks
2-3 weeks (Opt B)
```

Phases 1 and 2 are independent — can be done in parallel.
Total estimate: **6-9 weeks** to a shippable app.

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| JSC interpreter-only too slow | High | Low | JSC LLInt is fast; pi is I/O-bound (waiting for LLM) |
| App Store rejects custom JSC | High | Very Low | Hermes/V8/QuickJS all approved; zero private APIs |
| Bun Node APIs incomplete for pi | Medium | Medium | Option B: implement only what pi needs |
| just-bash missing commands | Low | Low | `defineCommand()` API for custom additions |
| Ghostty lib size (195MB) | Medium | Certain | Strip debug symbols → ~40-50MB; use bitcode |
| Total app size too large | Medium | Medium | Target ~80-100MB (Ghostty + JSC + pi bundle) |

## File Layout

```
PiTerminal/
├── PiTerminal.xcodeproj/
├── PiTerminal/
│   ├── App/
│   │   ├── PiTerminalApp.swift        # @main
│   │   ├── ContentView.swift          # SwiftUI root
│   │   └── Info.plist
│   ├── Terminal/
│   │   ├── GhosttyView.swift          # Ghostty surface wrapper
│   │   ├── KeyboardAccessoryBar.swift # Tab/Ctrl/Esc/Arrows
│   │   ├── KeyboardManager.swift      # UIKeyCommand, hardware KB
│   │   └── TerminalBridge.swift       # Ghostty ↔ Bun I/O bridge
│   ├── Runtime/
│   │   ├── BunRuntime.swift           # JSC context + Bun modules
│   │   ├── NodeCompat/               # Minimal node: polyfills
│   │   │   ├── fs.ts
│   │   │   ├── path.ts
│   │   │   ├── crypto.ts
│   │   │   └── os.ts
│   │   └── JustBashBridge.swift       # just-bash ↔ terminal
│   ├── Agent/
│   │   ├── PiSession.swift            # Pi SDK session manager
│   │   ├── ToolAdapters.swift         # Pi tools → iOS adapters
│   │   └── APIKeyManager.swift        # Keychain storage
│   └── Resources/
│       ├── pi-bundle.js               # Bundled pi + just-bash
│       └── ghostty.conf               # Terminal theme/config
├── Frameworks/
│   ├── GhosttyKit.xcframework/       # Ghostty static lib
│   └── BunJSC.xcframework/           # JSC static libs + headers
└── project.yml                        # XcodeGen
```
