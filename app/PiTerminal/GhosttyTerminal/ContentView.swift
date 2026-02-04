import SwiftUI
import GhosttyKit

struct ContentView: View {
    @EnvironmentObject var ghosttyApp: GhosttyAppManager

    var body: some View {
        if let app = ghosttyApp.app {
            TerminalViewRepresentable(app: app)
                .ignoresSafeArea()
        } else {
            Text("Failed to initialize terminal")
                .foregroundStyle(.red)
        }
    }
}

struct TerminalViewRepresentable: UIViewRepresentable {
    let app: ghostty_app_t

    func makeUIView(context: Context) -> TerminalView {
        let view = TerminalView(app: app)
        return view
    }

    func updateUIView(_ uiView: TerminalView, context: Context) {}
}
