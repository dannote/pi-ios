import SwiftUI

struct TerminalContentView: View {
  @EnvironmentObject var ghosttyManager: GhosttyAppManager
  @StateObject private var bunBridge = BunGhosttyBridge()

  var body: some View {
    ZStack {
      Color(red: 0.157, green: 0.173, blue: 0.204)
        .ignoresSafeArea()

      if let app = ghosttyManager.app {
        VStack(spacing: 0) {
          Spacer().frame(height: 0)
          TerminalViewRepresentable(app: app, bridge: bunBridge)
        }
        .padding(.top, 1)  // Force safe area respect
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
    // Delay start to allow view layout to complete
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
      bridge.start()
    }
    return view
  }

  func updateUIView(_ uiView: TerminalView, context: Context) {}
}
