import SwiftUI

struct TerminalContentView: View {
    @EnvironmentObject var ghosttyManager: GhosttyAppManager
    @StateObject private var bunBridge = BunGhosttyBridge()
    
    var body: some View {
        ZStack {
            Color.black.edgesIgnoringSafeArea(.all)
            
            if let app = ghosttyManager.app {
                TerminalViewRepresentable(app: app, bridge: bunBridge)
                    .edgesIgnoringSafeArea(.all)
            } else {
                Text("Initializing...")
                    .foregroundColor(.white)
            }
        }
    }
}

struct TerminalViewRepresentable: UIViewRepresentable {
    let app: ghostty_app_t
    let bridge: BunGhosttyBridge
    
    func makeUIView(context: Context) -> TerminalView {
        let view = TerminalView(app: app)
        bridge.terminalView = view
        bridge.start()
        return view
    }
    
    func updateUIView(_ uiView: TerminalView, context: Context) {}
}
