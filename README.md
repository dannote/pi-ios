# Pi Terminal

Pi coding agent on iOS — Ghostty + Bun's JSC + just-bash.

A native iOS terminal that runs [pi](https://github.com/badlogic/pi-mono) with
GPU-accelerated rendering (Ghostty), Node.js compatibility (Bun's JavaScriptCore),
and a virtual shell (just-bash).

## Status

Early research & proof-of-concept stage.

### What works

- **Ghostty on iOS** — Metal-rendered terminal with `Manual` I/O backend,
  keyboard input, surface resizing. Builds for arm64 + arm64-simulator.
- **Bun's JSC on iOS** — oven-sh/WebKit's JavaScriptCore compiled for
  iOS Simulator with JIT disabled. All JS features working. 238 private
  headers available (same APIs Bun uses). Zero private Apple APIs.
  See [`poc/jsc-ios-demo/`](poc/jsc-ios-demo/).

### What's next

See [PLAN.md](PLAN.md) for the full roadmap.

## Architecture

```
Ghostty (Metal)  ←→  Bridge (Swift)  ←→  Bun JSC  ←→  Pi Agent
                                              ↕
                                          just-bash
```

- **Ghostty** — terminal rendering and input. No WebView, no xterm.js.
- **Bun's JSC** — oven-sh/WebKit fork (99.77% vanilla), interpreter-only.
  Provides the Node.js API surface pi needs.
- **just-bash** — TypeScript bash interpreter with 80 commands and a
  virtual filesystem. Replaces `child_process.spawn()` on iOS.
- **Pi** — coding agent in SDK mode with tools adapted for the virtual environment.

## Repository structure

```
pi-terminal/
├── app/                    # iOS app (Swift + XcodeGen)
│   ├── PiTerminal/         # Ghostty terminal wrapper
│   └── project.yml
├── poc/                    # Proof of concepts
│   ├── jsc-ios-demo/       # JSC running on iOS Simulator
│   └── webkit-patches/     # Patches for oven-sh/WebKit + Ghostty iOS
├── scripts/
│   └── build-jsc-ios.sh    # Build JSC for iOS from source
└── PLAN.md                 # Detailed implementation plan
```

## Dependencies (not included)

These are referenced as external builds, not git submodules:

| Dependency | What | How to get |
|------------|------|------------|
| [ghostty-org/ghostty](https://github.com/ghostty-org/ghostty) | Terminal library | Apply `poc/webkit-patches/ghostty-ios-manual-backend.patch`, build with `zig build` for ios |
| [oven-sh/WebKit](https://github.com/oven-sh/WebKit) | JavaScriptCore | Apply `poc/webkit-patches/ios-build-fixes.patch`, use `scripts/build-jsc-ios.sh` |
| [badlogic/pi-mono](https://github.com/badlogic/pi-mono) | Pi coding agent | npm package, bundled at build time |
| [vercel-labs/just-bash](https://github.com/vercel-labs/just-bash) | Virtual bash | npm package, bundled at build time |

## App Store viability

Analyzed in detail during the JSC PoC. Summary:

- **Zero private Apple APIs** — binary links only UIKit, Foundation, CoreFoundation, libicucore, libc++, libSystem
- **Precedent** — Hermes (React Native), V8 jitless (NativeScript), QuickJS, Lua all ship custom JS/scripting engines on iOS
- **Bun's JSC fork is 99.77% upstream WebKit** — 3,808 lines changed out of 1.63M, all behind `USE(BUN_*)` compile guards
