import SwiftUI

@main
struct PiApp: App {
  @StateObject private var ghosttyManager = GhosttyAppManager()

  init() {
    // Set HOME early - iOS doesn't have a traditional home directory
    // This must be set before Bun/Zig tries to access it
    let documentsDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!.path
    setenv("HOME", documentsDir, 1)
    setenv("TMPDIR", NSTemporaryDirectory(), 1)
    
    // Disable Gigacage - iOS doesn't allow large virtual memory allocations
    setenv("GIGACAGE_ENABLED", "0", 1)
  }

  var body: some Scene {
    WindowGroup {
      TerminalContentView()
        .environmentObject(ghosttyManager)
    }
  }
}
