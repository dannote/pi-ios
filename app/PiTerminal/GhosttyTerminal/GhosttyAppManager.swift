import SwiftUI
import GhosttyKit

final class GhosttyAppManager: ObservableObject {
    @Published private(set) var app: ghostty_app_t?

    init() {
        // Initialize the ghostty runtime (allocators, logging, etc.)
        let argc = CommandLine.argc
        let argv = CommandLine.unsafeArgv
        guard ghostty_init(UInt(argc), argv) == 0 else {
            print("ghostty_init failed")
            return
        }

        let config = ghostty_config_new()!
        // Write a temporary config file with dark theme
        let configContent = "background = 282c34\nforeground = abb2bf\n"
        let tmpConfig = NSTemporaryDirectory() + "ghostty-config"
        try? configContent.write(toFile: tmpConfig, atomically: true, encoding: .utf8)
        tmpConfig.withCString { path in
            ghostty_config_load_file(config, path)
        }
        ghostty_config_finalize(config)

        var runtimeCfg = ghostty_runtime_config_s(
            userdata: Unmanaged.passUnretained(self).toOpaque(),
            supports_selection_clipboard: false,
            wakeup_cb: { _ in
                DispatchQueue.main.async {
                    // Trigger app tick on next run loop
                    NotificationCenter.default.post(name: .ghosttyWakeup, object: nil)
                }
            },
            action_cb: { _, _, _ in true },
            read_clipboard_cb: { _, _, _ in },
            confirm_read_clipboard_cb: { _, _, _, _ in },
            write_clipboard_cb: { _, _, _, _, _ in },
            close_surface_cb: { _, _ in }
        )

        guard let app = ghostty_app_new(&runtimeCfg, config) else {
            print("Failed to create ghostty app")
            return
        }

        self.app = app

        NotificationCenter.default.addObserver(
            forName: .ghosttyWakeup, object: nil, queue: .main
        ) { [weak self] _ in
            guard let app = self?.app else { return }
            ghostty_app_tick(app)
        }
    }

    deinit {
        if let app {
            ghostty_app_free(app)
        }
    }
}

extension Notification.Name {
    static let ghosttyWakeup = Notification.Name("ghosttyWakeup")
}
