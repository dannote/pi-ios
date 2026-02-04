import SwiftUI

@main
struct GhosttyTerminalApp: App {
    @StateObject private var ghosttyApp = GhosttyAppManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(ghosttyApp)
        }
    }
}
