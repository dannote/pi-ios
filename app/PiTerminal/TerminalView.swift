import UIKit

final class TerminalView: UIView, UIKeyInput, @unchecked Sendable {
    nonisolated(unsafe) private(set) var surface: ghostty_surface_t?
    
    /// Callback for keyboard input - set by the bridge
    var onInput: ((String) -> Void)?
    
    /// Control key modifier state
    private var controlKeyActive = false
    
    /// Cached key commands for hardware keyboard
    private var _keyCommands: [UIKeyCommand]?

    var hasText: Bool { true }

    override var canBecomeFirstResponder: Bool { true }
    
    // MARK: - Keyboard Traits (disable smart features like iSH)
    
    var autocapitalizationType: UITextAutocapitalizationType { .none }
    var autocorrectionType: UITextAutocorrectionType { .no }
    var smartQuotesType: UITextSmartQuotesType { .no }
    var smartDashesType: UITextSmartDashesType { .no }
    var smartInsertDeleteType: UITextSmartInsertDeleteType { .no }
    var spellCheckingType: UITextSpellCheckingType { .no }
    var keyboardType: UIKeyboardType { .asciiCapable }

    init(app: ghostty_app_t) {
        super.init(frame: CGRect(x: 0, y: 0, width: 800, height: 600))
        backgroundColor = .clear
        
        // Disable keyboard shortcuts bar
        inputAssistantItem.leadingBarButtonGroups = []
        inputAssistantItem.trailingBarButtonGroups = []

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

    // MARK: - UIKeyInput (Software Keyboard)

    func insertText(_ text: String) {
        var processedText = text
        
        // Handle control key modifier
        if controlKeyActive {
            controlKeyActive = false
            if text.count == 1, let char = text.first {
                sendControlChar(char)
                return
            }
        }
        
        // Replace newline with carriage return (Enter key)
        processedText = processedText.replacingOccurrences(of: "\n", with: "\r")
        
        // Send to Bun - let Bun/readline handle echo
        onInput?(processedText)
    }

    func deleteBackward() {
        // Send DEL character (0x7F) - let Bun handle echo
        onInput?("\u{7f}")
    }
    
    // MARK: - Control Characters
    
    private func sendControlChar(_ char: Character) {
        let controlKeys = "abcdefghijklmnopqrstuvwxyz@^26-=[]\\ "
        guard controlKeys.contains(char.lowercased()) else { return }
        
        var ch = char.asciiValue ?? 0
        if ch == UInt8(ascii: " ") { ch = 0 }
        else if ch == UInt8(ascii: "2") { ch = UInt8(ascii: "@") }
        else if ch == UInt8(ascii: "6") { ch = UInt8(ascii: "^") }
        
        if ch != 0 {
            ch = (ch & 0xDF) ^ 0x40
        }
        
        let str = String(UnicodeScalar(ch))
        onInput?(str)
    }
    
    // MARK: - Hardware Keyboard (UIKeyCommand)
    
    override var keyCommands: [UIKeyCommand]? {
        if let cached = _keyCommands { return cached }
        
        var commands: [UIKeyCommand] = []
        
        // Control+letter combinations
        let controlKeys = "abcdefghijklmnopqrstuvwxyz@^26-=[]\\ "
        for char in controlKeys {
            let cmd = UIKeyCommand(
                input: String(char),
                modifierFlags: .control,
                action: #selector(handleKeyCommand(_:))
            )
            cmd.wantsPriorityOverSystemBehavior = true
            commands.append(cmd)
        }
        
        // Arrow keys
        for arrow in [UIKeyCommand.inputUpArrow, UIKeyCommand.inputDownArrow,
                      UIKeyCommand.inputLeftArrow, UIKeyCommand.inputRightArrow] {
            let cmd = UIKeyCommand(
                input: arrow,
                modifierFlags: [],
                action: #selector(handleKeyCommand(_:))
            )
            cmd.wantsPriorityOverSystemBehavior = true
            commands.append(cmd)
        }
        
        // Escape
        let esc = UIKeyCommand(
            input: UIKeyCommand.inputEscape,
            modifierFlags: [],
            action: #selector(handleKeyCommand(_:))
        )
        esc.wantsPriorityOverSystemBehavior = true
        commands.append(esc)
        
        // Tab
        let tab = UIKeyCommand(
            input: "\t",
            modifierFlags: [],
            action: #selector(handleKeyCommand(_:))
        )
        tab.wantsPriorityOverSystemBehavior = true
        commands.append(tab)
        
        // Option+key for ESC prefix (Meta key)
        let metaKeys = "abcdefghijklmnopqrstuvwxyz0123456789-=[]\\;',./"
        for char in metaKeys {
            let cmd = UIKeyCommand(
                input: String(char),
                modifierFlags: .alternate,
                action: #selector(handleKeyCommand(_:))
            )
            commands.append(cmd)
        }
        
        _keyCommands = commands
        return commands
    }
    
    @objc private func handleKeyCommand(_ command: UIKeyCommand) {
        guard let key = command.input else { return }
        
        if command.modifierFlags.isEmpty {
            switch key {
            case UIKeyCommand.inputEscape:
                onInput?("\u{1b}")
            case UIKeyCommand.inputUpArrow:
                onInput?("\u{1b}[A")
            case UIKeyCommand.inputDownArrow:
                onInput?("\u{1b}[B")
            case UIKeyCommand.inputRightArrow:
                onInput?("\u{1b}[C")
            case UIKeyCommand.inputLeftArrow:
                onInput?("\u{1b}[D")
            default:
                onInput?(key)
            }
        } else if command.modifierFlags.contains(.alternate) {
            onInput?("\u{1b}" + key)
        } else if command.modifierFlags.contains(.control) {
            if let char = key.first {
                sendControlChar(char)
            }
        }
    }
}
