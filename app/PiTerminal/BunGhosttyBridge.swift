import Foundation
import os.log

private let log = OSLog(subsystem: "dev.pi.terminal", category: "Bridge")

nonisolated(unsafe) private var globalTerminalView: TerminalView?

private func bunExitCallback(code: UInt32) {
    os_log("Bun exited: %d", log: log, type: .default, code)
    DispatchQueue.main.async {
        globalTerminalView?.writeOutput("\r\n\u{1b}[33m[Process exited: \(code)]\u{1b}[0m\r\n")
    }
}

final class BunGhosttyBridge: ObservableObject, @unchecked Sendable {
    weak var terminalView: TerminalView? {
        didSet {
            globalTerminalView = terminalView
            terminalView?.onInput = { [weak self] text in
                self?.sendInput(text)
            }
        }
    }
    
    private var stdinWriteFd: Int32 = -1
    private var stdoutReadFd: Int32 = -1
    private var isRunning = false
    
    func start() {
        os_log("Starting Bun bridge", log: log, type: .default)
        
        var stdinPipe: [Int32] = [0, 0]
        var stdoutPipe: [Int32] = [0, 0]
        
        guard pipe(&stdinPipe) == 0, pipe(&stdoutPipe) == 0 else {
            os_log("Failed to create pipes", log: log, type: .error)
            terminalView?.writeOutput("\u{1b}[31mFailed to create pipes\u{1b}[0m\r\n")
            return
        }
        
        stdinWriteFd = stdinPipe[1]
        stdoutReadFd = stdoutPipe[0]
        isRunning = true
        
        let readFd = stdoutReadFd
        Thread { [weak self] in
            var buffer = [CChar](repeating: 0, count: 4096)
            while self?.isRunning == true {
                let n = read(readFd, &buffer, buffer.count - 1)
                if n > 0 {
                    buffer[Int(n)] = 0
                    var str = String(cString: buffer)
                    // Convert lone \n to \r\n for proper terminal display
                    // But don't double-convert \r\n
                    str = str.replacingOccurrences(of: "\r\n", with: "\u{0000}\u{0001}")
                    str = str.replacingOccurrences(of: "\n", with: "\r\n")
                    str = str.replacingOccurrences(of: "\u{0000}\u{0001}", with: "\r\n")
                    DispatchQueue.main.async {
                        globalTerminalView?.writeOutput(str)
                    }
                } else if n == 0 || (n < 0 && errno != EAGAIN && errno != EINTR) {
                    break
                }
            }
        }.start()
        
        terminalView?.writeOutput("\u{1b}[2J\u{1b}[H")
        terminalView?.writeOutput("\u{1b}[1;36mPi\u{1b}[0m — AI Coding Agent\r\n\r\n")
        
        // Get bundle resources
        guard let bundlePath = Bundle.main.path(forResource: "pi-ios-bundle", ofType: "js"),
              let entryPath = Bundle.main.path(forResource: "ios-entry", ofType: "js") else {
            os_log("Bundle resources not found", log: log, type: .error)
            terminalView?.writeOutput("\u{1b}[31mBundle resources not found\u{1b}[0m\r\n")
            return
        }
        
        // Get Documents directory for working dir
        let documentsDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!.path
        
        // Copy bundle to Documents if needed (bundle resources are read-only)
        let targetBundlePath = (documentsDir as NSString).appendingPathComponent("pi-ios-bundle.js")
        if !FileManager.default.fileExists(atPath: targetBundlePath) {
            do {
                try FileManager.default.copyItem(atPath: bundlePath, toPath: targetBundlePath)
                os_log("Copied bundle to Documents", log: log, type: .default)
            } catch {
                os_log("Failed to copy bundle: %@", log: log, type: .error, error.localizedDescription)
            }
        }
        
        // Load API key from config.json in Documents
        let configPath = (documentsDir as NSString).appendingPathComponent("config.json")
        var apiKey = ""
        if FileManager.default.fileExists(atPath: configPath),
           let data = FileManager.default.contents(atPath: configPath),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let key = json["openrouter_api_key"] as? String {
            apiKey = key
            os_log("Loaded API key from config", log: log, type: .default)
        } else {
            os_log("No config.json found, API key not set", log: log, type: .default)
        }
        
        setenv("OPENROUTER_API_KEY", apiKey, 1)
        setenv("PI_DOCUMENTS_DIR", documentsDir, 1)
        setenv("PI_MODEL", "anthropic/claude-3.5-haiku", 1)
        
        var args = [documentsDir, entryPath, documentsDir]
        
        var cArgs: [UnsafeMutablePointer<CChar>?] = args.map { strdup($0) }
        cArgs.append(nil)
        
        let result = cArgs.withUnsafeMutableBufferPointer { buf in
            bun_main_with_io(
                Int32(args.count),
                buf.baseAddress!,
                stdinPipe[0],
                stdoutPipe[1],
                stdoutPipe[1],
                bunExitCallback
            )
        }
        
        cArgs.dropLast().forEach { free($0) }
        
        if result != 0 {
            os_log("Failed to start Bun: %d", log: log, type: .error, result)
            terminalView?.writeOutput("\u{1b}[31mFailed to start Bun\u{1b}[0m\r\n")
            stop()
            return
        }
        
        close(stdinPipe[0])
        close(stdoutPipe[1])
        
        os_log("Bun started", log: log, type: .default)
    }
    
    func sendInput(_ text: String) {
        guard stdinWriteFd >= 0 else { return }
        _ = text.withCString { ptr in
            write(stdinWriteFd, ptr, strlen(ptr))
        }
    }
    
    func stop() {
        isRunning = false
        if stdinWriteFd >= 0 { close(stdinWriteFd); stdinWriteFd = -1 }
        if stdoutReadFd >= 0 { close(stdoutReadFd); stdoutReadFd = -1 }
    }
}
