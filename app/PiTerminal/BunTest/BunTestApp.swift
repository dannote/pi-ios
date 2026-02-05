import SwiftUI
import os.log

private let log = OSLog(subsystem: "dev.bun.test", category: "BunTest")

nonisolated(unsafe) private var exitHandler: ((UInt32) -> Void)?

private func bunExitCallback(code: UInt32) {
    os_log("Bun exit callback: %d", log: log, type: .default, code)
    exitHandler?(code)
}

@main
struct BunTestApp: App {
    init() {
        os_log("BunTestApp init", log: log, type: .default)
        
        DispatchQueue.global().asyncAfter(deadline: .now() + 1) {
            testWithPipes()
        }
    }
    
    var body: some Scene {
        WindowGroup {
            Text("BunTest")
        }
    }
}

private func testWithPipes() {
    os_log("Testing bun_main_with_io", log: log, type: .default)
    
    // Create pipes
    var stdoutPipe: [Int32] = [0, 0]
    guard pipe(&stdoutPipe) == 0 else {
        os_log("Failed to create stdout pipe", log: log, type: .error)
        return
    }
    
    os_log("Created pipe: read=%d, write=%d", log: log, type: .default, stdoutPipe[0], stdoutPipe[1])
    
    // Start reading thread
    let readFd = stdoutPipe[0]
    Thread {
        os_log("Read thread started", log: log, type: .default)
        var buffer = [CChar](repeating: 0, count: 1024)
        while true {
            let n = read(readFd, &buffer, buffer.count - 1)
            if n > 0 {
                buffer[Int(n)] = 0
                let str = String(cString: buffer)
                os_log("Read from pipe: %{public}@", log: log, type: .default, str)
            } else if n == 0 {
                os_log("Pipe EOF", log: log, type: .default)
                break
            } else {
                os_log("Pipe read error: %d", log: log, type: .error, errno)
                break
            }
        }
    }.start()
    
    exitHandler = { code in
        os_log("Exit handler: %d", log: log, type: .default, code)
    }
    
    // Prepare args
    var args = ["/tmp", "-e", "console.log('Hello from pipe!')"]
    var cArgs: [UnsafeMutablePointer<CChar>?] = args.map { strdup($0) }
    cArgs.append(nil)
    
    let result = cArgs.withUnsafeMutableBufferPointer { buf in
        bun_main_with_io(
            Int32(args.count),
            buf.baseAddress!,
            -2,              // keep stdin
            stdoutPipe[1],   // redirect stdout to pipe
            -1,              // stderr same as stdout
            bunExitCallback
        )
    }
    
    cArgs.dropLast().forEach { free($0) }
    
    os_log("bun_main_with_io returned: %d", log: log, type: .default, result)
    
    // Close write end in main process (Bun has it now)
    close(stdoutPipe[1])
}
