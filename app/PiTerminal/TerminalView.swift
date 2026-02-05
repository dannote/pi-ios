import UIKit
import GhosttyKit

final class TerminalView: UIView, UIKeyInput, @unchecked Sendable {
    nonisolated(unsafe) private(set) var surface: ghostty_surface_t?
    
    /// Callback for keyboard input - set by the bridge
    var onInput: ((String) -> Void)?

    var hasText: Bool { true }

    override var canBecomeFirstResponder: Bool { true }

    init(app: ghostty_app_t) {
        super.init(frame: CGRect(x: 0, y: 0, width: 800, height: 600))
        backgroundColor = .clear

        var config = ghostty_surface_config_new()
        config.userdata = Unmanaged.passUnretained(self).toOpaque()
        config.platform_tag = GHOSTTY_PLATFORM_IOS
        config.platform = ghostty_platform_u(
            ios: ghostty_platform_ios_s(
                uiview: Unmanaged.passUnretained(self).toOpaque()
            )
        )
        config.scale_factor = UIScreen.main.scale

        guard let surface = ghostty_surface_new(app, &config) else { return }
        self.surface = surface
        ghostty_surface_set_focus(surface, true)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported")
    }

    deinit {
        if let surface {
            ghostty_surface_free(surface)
        }
    }

    // MARK: - Layout

    override func didMoveToWindow() {
        super.didMoveToWindow()
        guard let surface, window != nil else { return }

        let scale = window!.screen.scale
        ghostty_surface_set_content_scale(surface, scale, scale)
        updateSurfaceSize()
        becomeFirstResponder()
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        if let sublayer = layer.sublayers?.first {
            sublayer.frame = layer.bounds
        }
        updateSurfaceSize()
    }

    private func updateSurfaceSize() {
        guard let surface else { return }
        let scale = window?.screen.scale ?? UIScreen.main.scale
        ghostty_surface_set_size(
            surface,
            UInt32(bounds.width * scale),
            UInt32(bounds.height * scale)
        )
    }

    // MARK: - Output

    func writeOutput(_ text: String) {
        guard let surface else { return }
        text.withCString { ptr in
            ghostty_surface_write_output(surface, ptr, UInt(strlen(ptr)))
        }
    }

    // MARK: - Touch → Focus

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        super.touchesBegan(touches, with: event)
        if !isFirstResponder { becomeFirstResponder() }
    }

    // MARK: - UIKeyInput

    func insertText(_ text: String) {
        // Send to callback if set (Bun bridge), otherwise just to terminal
        if let onInput = onInput {
            onInput(text)
        }
        
        // Also send to terminal for local echo (optional - Bun might echo)
        guard let surface else { return }
        text.withCString { ptr in
            ghostty_surface_text(surface, ptr, UInt(strlen(ptr)))
        }
    }

    func deleteBackward() {
        // Send backspace to callback
        onInput?("\u{7f}")
        
        guard let surface else { return }
        let bs: [CChar] = [0x7f, 0]
        bs.withUnsafeBufferPointer { buf in
            ghostty_surface_text(surface, buf.baseAddress, 1)
        }
    }
}
