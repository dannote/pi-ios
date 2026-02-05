import SwiftUI

@main
struct PiTerminalApp: App {
    @StateObject private var ghosttyManager = GhosttyAppManager()
    
    var body: some Scene {
        WindowGroup {
            TerminalContentView()
                .environmentObject(ghosttyManager)
        }
    }
}
