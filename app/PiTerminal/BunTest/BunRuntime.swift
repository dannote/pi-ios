import Foundation

nonisolated(unsafe) private var bunExitCallback: ((UInt32) -> Void)?

private func bunExitHandler(exitCode: UInt32) {
    print("BunRuntime: Exit handler called with code: \(exitCode)")
    bunExitCallback?(exitCode)
    bunExitCallback = nil
}

@MainActor
class BunRuntime: ObservableObject {
    static let shared = BunRuntime()
    
    @Published private(set) var isRunning = false
    @Published private(set) var lastExitCode: UInt32?
    
    private init() {}
    
    func eval(_ code: String, workingDir: String = FileManager.default.currentDirectoryPath) async -> UInt32 {
        guard !isRunning else {
            print("BunRuntime: Already running")
            return 1
        }
        
        print("BunRuntime: Starting eval...")
        isRunning = true
        lastExitCode = nil
        
        return await withCheckedContinuation { continuation in
            bunExitCallback = { [weak self] exitCode in
                Task { @MainActor in
                    print("BunRuntime: Callback received, code: \(exitCode)")
                    self?.isRunning = false
                    self?.lastExitCode = exitCode
                    continuation.resume(returning: exitCode)
                }
            }
            
            print("BunRuntime: Calling bun_eval_async with workingDir: \(workingDir)")
            print("BunRuntime: Code: \(code)")
            let result = bun_eval_async(workingDir, code, bunExitHandler)
            print("BunRuntime: bun_eval_async returned: \(result)")
            
            if result != 0 {
                print("BunRuntime: Failed to start thread")
                bunExitCallback = nil
                self.isRunning = false
                continuation.resume(returning: 1)
            }
        }
    }
    
    func run(args: [String]) async -> UInt32 {
        guard !isRunning else { return 1 }
        
        isRunning = true
        lastExitCode = nil
        
        return await withCheckedContinuation { continuation in
            bunExitCallback = { [weak self] exitCode in
                Task { @MainActor in
                    self?.isRunning = false
                    self?.lastExitCode = exitCode
                    continuation.resume(returning: exitCode)
                }
            }
            
            var cArgs = args.map { strdup($0) }
            cArgs.append(nil)
            
            let result = bun_main_thread(Int32(args.count), &cArgs, bunExitHandler)
            
            for ptr in cArgs.dropLast() { free(ptr) }
            
            if result != 0 {
                bunExitCallback = nil
                self.isRunning = false
                continuation.resume(returning: 1)
            }
        }
    }
}
