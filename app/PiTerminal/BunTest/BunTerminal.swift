import Foundation

// Global state for callbacks (C function pointers can't capture context)
nonisolated(unsafe) private var globalOutputCallback: ((String) -> Void)?
nonisolated(unsafe) private var globalExitCallback: ((UInt32) -> Void)?

private func bunOutputHandler(_ data: UnsafePointer<CChar>?, _ len: Int) {
    guard let data = data, len > 0 else { return }
    let str = String(cString: data)
    globalOutputCallback?(str)
}

private func bunExitHandler(_ code: UInt32) {
    globalExitCallback?(code)
}

/// Connects Bun's I/O to callbacks for terminal integration
final class BunTerminal: @unchecked Sendable {
    private var stdinWriteFd: Int32 = -1
    private var stdoutReadFd: Int32 = -1
    private var readThread: Thread?
    private var isRunning = false
    
    deinit {
        stop()
    }
    
    /// Start Bun with the given arguments.
    func start(args: [String], 
               onOutput: @escaping (String) -> Void, 
               onExit: @escaping (UInt32) -> Void) -> Bool {
        
        globalOutputCallback = onOutput
        globalExitCallback = onExit
        
        // Create pipes
        var stdinPipe: [Int32] = [0, 0]
        var stdoutPipe: [Int32] = [0, 0]
        
        guard pipe(&stdinPipe) == 0, pipe(&stdoutPipe) == 0 else {
            print("BunTerminal: Failed to create pipes")
            return false
        }
        
        stdinWriteFd = stdinPipe[1]
        stdoutReadFd = stdoutPipe[0]
        isRunning = true
        
        // Start reading thread
        let readFd = stdoutReadFd
        readThread = Thread { [weak self] in
            var buffer = [CChar](repeating: 0, count: 4096)
            while self?.isRunning == true {
                let bytesRead = read(readFd, &buffer, buffer.count - 1)
                if bytesRead > 0 {
                    buffer[Int(bytesRead)] = 0
                    let str = String(cString: buffer)
                    DispatchQueue.main.async {
                        globalOutputCallback?(str)
                    }
                } else if bytesRead == 0 {
                    break  // EOF
                } else if errno != EAGAIN && errno != EINTR {
                    break  // Error
                }
            }
        }
        readThread?.start()
        
        // Prepare C args
        var cArgPtrs: [UnsafeMutablePointer<CChar>?] = args.map { strdup($0) }
        cArgPtrs.append(nil)
        
        let result = cArgPtrs.withUnsafeMutableBufferPointer { buffer in
            bun_main_with_io(
                Int32(args.count),
                buffer.baseAddress!,
                stdinPipe[0],
                stdoutPipe[1],
                -1,
                bunExitHandler
            )
        }
        
        // Free C strings
        for ptr in cArgPtrs.dropLast() {
            free(ptr)
        }
        
        if result != 0 {
            print("BunTerminal: Failed to start Bun, result = \(result)")
            stop()
            return false
        }
        
        // Close ends Bun uses
        close(stdinPipe[0])
        close(stdoutPipe[1])
        
        return true
    }
    
    /// Send input to Bun's stdin
    func write(_ text: String) {
        guard stdinWriteFd >= 0 else { return }
        _ = text.withCString { ptr in
            Darwin.write(stdinWriteFd, ptr, strlen(ptr))
        }
    }
    
    /// Stop and clean up
    func stop() {
        isRunning = false
        readThread = nil
        globalOutputCallback = nil
        globalExitCallback = nil
        
        if stdinWriteFd >= 0 { close(stdinWriteFd); stdinWriteFd = -1 }
        if stdoutReadFd >= 0 { close(stdoutReadFd); stdoutReadFd = -1 }
    }
}
