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
        
        // Start reading thread
        let readFd = stdoutReadFd
        Thread { [weak self] in
            var buffer = [CChar](repeating: 0, count: 4096)
            while self?.isRunning == true {
                let n = read(readFd, &buffer, buffer.count - 1)
                if n > 0 {
                    buffer[Int(n)] = 0
                    let str = String(cString: buffer)
                    DispatchQueue.main.async {
                        globalTerminalView?.writeOutput(str)
                    }
                } else if n == 0 || (n < 0 && errno != EAGAIN && errno != EINTR) {
                    break
                }
            }
        }.start()
        
        // Print welcome message directly to terminal
        terminalView?.writeOutput("\u{1b}[2J\u{1b}[H")  // Clear screen
        terminalView?.writeOutput("\u{1b}[1;36mPi Terminal\u{1b}[0m — Bun 1.3.9 on iOS\r\n")
        terminalView?.writeOutput("Type JavaScript expressions or 'exit' to quit\r\n\r\n")
        
        // Simple REPL without readline (manual echo and line buffering)
        var args = ["/tmp", "-e", """
            let line = '';
            process.stdout.write('> ');
            process.stdin.setRawMode?.(false); // Ensure cooked mode
            process.stdin.on('data', (chunk) => {
                const str = chunk.toString();
                for (const ch of str) {
                    if (ch === '\\r' || ch === '\\n') {
                        process.stdout.write('\\r\\n');
                        const trimmed = line.trim();
                        if (trimmed === 'exit' || trimmed === 'quit') {
                            process.exit(0);
                        }
                        if (trimmed) {
                            try {
                                const result = eval(trimmed);
                                if (result !== undefined) {
                                    console.log(result);
                                }
                            } catch (e) {
                                console.error('\\x1b[31m' + e.message + '\\x1b[0m');
                            }
                        }
                        line = '';
                        process.stdout.write('> ');
                    } else if (ch === '\\x7f' || ch === '\\b') {
                        // Backspace
                        if (line.length > 0) {
                            line = line.slice(0, -1);
                            process.stdout.write('\\b \\b');
                        }
                    } else if (ch >= ' ') {
                        line += ch;
                        process.stdout.write(ch);
                    }
                }
            });
            """]
        
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
        
        os_log("Bun REPL started", log: log, type: .default)
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
