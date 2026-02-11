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
          // Pass output directly to Ghostty - let it handle line endings
          DispatchQueue.main.async {
            globalTerminalView?.writeOutput(str)
          }
        } else if n == 0 || (n < 0 && errno != EAGAIN && errno != EINTR) {
          break
        }
      }
    }.start()

    // Clear screen and home cursor - let TUI handle all rendering
    terminalView?.writeOutput("\u{1b}[2J\u{1b}[H")

    // Get bundle resources
    guard let bundlePath = Bundle.main.path(forResource: "pi-ios-bundle", ofType: "js"),
      let entryPath = Bundle.main.path(forResource: "ios-entry", ofType: "js")
    else {
      os_log("Bundle resources not found", log: log, type: .error)
      terminalView?.writeOutput("\u{1b}[31mBundle resources not found\u{1b}[0m\r\n")
      return
    }

    // Get Documents directory for working dir
    let documentsDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
      .path

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

    // Create dummy package.json (bundle reads it at import time)
    let packageJsonPath = (documentsDir as NSString).appendingPathComponent("package.json")
    if !FileManager.default.fileExists(atPath: packageJsonPath) {
      let packageJson = """
        {
            "name": "pi-terminal-ios",
            "version": "1.0.0",
            "piConfig": {
                "name": "pi",
                "configDir": ".pi"
            }
        }
        """
      try? packageJson.write(toFile: packageJsonPath, atomically: true, encoding: .utf8)
      os_log("Created package.json", log: log, type: .default)
    }

    // Load API key from config.json in Documents
    let userConfigPath = (documentsDir as NSString).appendingPathComponent("config.json")
    var apiKey = ""
    if FileManager.default.fileExists(atPath: userConfigPath),
      let data = FileManager.default.contents(atPath: userConfigPath),
      let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
      let key = json["openrouter_api_key"] as? String {
      apiKey = key
      os_log("Loaded API key from config", log: log, type: .default)
    } else {
      os_log("No config.json found, API key not set", log: log, type: .default)
    }

    // Set agent dir to Documents to avoid loading skills from Mac's ~/.pi
    let agentDir = (documentsDir as NSString).appendingPathComponent(".pi/agent")
    try? FileManager.default.createDirectory(atPath: agentDir, withIntermediateDirectories: true)

    // Get terminal size from Ghostty
    var termColumns = 80
    var termRows = 24
    if let surface = terminalView?.surface {
      let size = ghostty_surface_size(surface)
      termColumns = Int(size.columns)
      termRows = Int(size.rows)
      os_log("Terminal size: %d x %d", log: log, type: .default, size.columns, size.rows)
    }

    // Write config file for JS to read (env vars don't work with bun_main_with_io)
    let piConfig: [String: Any] = [
      "openrouterApiKey": apiKey,
      "documentsDir": documentsDir,
      "model": "anthropic/claude-3.5-haiku",
      "agentDir": agentDir,
      "forceFullRender": true,
      "terminalColumns": termColumns,
      "terminalRows": termRows
    ]
    let piConfigPath = (documentsDir as NSString).appendingPathComponent("pi-config.json")
    if let configData = try? JSONSerialization.data(withJSONObject: piConfig),
      let configString = String(data: configData, encoding: .utf8) {
      try? configString.write(toFile: piConfigPath, atomically: true, encoding: .utf8)
      os_log("Wrote pi-config.json", log: log, type: .default)
    }

    // Suppress update notifications - we're embedded in an iOS app
    setenv("PI_SKIP_VERSION_CHECK", "1", 1)

    var args = [documentsDir, entryPath, documentsDir]

    var cArgs: [UnsafeMutablePointer<CChar>?] = args.map { strdup($0) }
    cArgs.append(nil)

    let result = cArgs.withUnsafeMutableBufferPointer { buf in
      bun_start(
        Int32(args.count),
        UnsafeMutablePointer(
          mutating: buf.baseAddress!.withMemoryRebound(
            to: UnsafePointer<CChar>?.self, capacity: args.count + 1
          ) { $0 }),
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
    if stdinWriteFd >= 0 {
      close(stdinWriteFd)
      stdinWriteFd = -1
    }
    if stdoutReadFd >= 0 {
      close(stdoutReadFd)
      stdoutReadFd = -1
    }
  }
}
