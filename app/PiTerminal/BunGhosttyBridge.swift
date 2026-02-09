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
                    let str = String(cString: buffer)
                    DispatchQueue.main.async {
                        globalTerminalView?.writeOutput(str)
                    }
                } else if n == 0 || (n < 0 && errno != EAGAIN && errno != EINTR) {
                    break
                }
            }
        }.start()
        
        terminalView?.writeOutput("\u{1b}[2J\u{1b}[H")
        terminalView?.writeOutput("\u{1b}[1;36mPi Terminal\u{1b}[0m — Testing just-bash\r\n\r\n")
        
        // Test just-bash
        var args = ["/tmp", "-e", """
            console.log('Loading just-bash...');
            
            // Dynamic import of bundled just-bash
            const { Bash } = await import('/tmp/just-bash.js');
            
            console.log('Creating Bash instance...');
            const bash = new Bash({
                files: {
                    '/home/user/hello.txt': 'Hello from just-bash on iOS!',
                    '/home/user/data.json': JSON.stringify({ name: 'Pi Terminal', platform: 'iOS' })
                }
            });
            
            console.log('Testing commands...');
            console.log('');
            
            // Test various commands
            let result;
            
            result = await bash.exec('cat /home/user/hello.txt');
            console.log('cat hello.txt:', result.stdout.trim());
            
            result = await bash.exec('ls -la /home/user');
            console.log('');
            console.log('ls -la /home/user:');
            console.log(result.stdout);
            
            result = await bash.exec('echo "Created on iOS" > /tmp/test.txt && cat /tmp/test.txt');
            console.log('echo + cat:', result.stdout.trim());
            
            result = await bash.exec('jq .name /home/user/data.json');
            console.log('jq .name:', result.stdout.trim());
            
            result = await bash.exec('grep -r "iOS" /home/user');
            console.log('grep iOS:', result.stdout.trim());
            
            console.log('');
            console.log('✅ just-bash works on iOS!');
            process.exit(0);
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
