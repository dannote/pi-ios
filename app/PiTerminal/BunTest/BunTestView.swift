import SwiftUI

struct BunTestView: View {
    @StateObject private var bun = BunRuntime.shared
    @State private var output = "Press 'Run' to test Bun"
    @State private var code = "console.log('Test: ' + (2+2));"
    
    var body: some View {
        VStack(spacing: 20) {
            Text("Bun iOS Test")
                .font(.largeTitle)
            
            TextEditor(text: $code)
                .font(.system(.body, design: .monospaced))
                .frame(height: 150)
                .border(Color.gray)
                .padding(.horizontal)
            
            Button(action: runCode) {
                if bun.isRunning {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle())
                } else {
                    Text("Run")
                        .font(.headline)
                }
            }
            .disabled(bun.isRunning)
            .buttonStyle(.borderedProminent)
            
            ScrollView {
                Text(output)
                    .font(.system(.body, design: .monospaced))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
            }
            .frame(maxHeight: .infinity)
            .background(Color.black.opacity(0.05))
            .cornerRadius(8)
            .padding(.horizontal)
        }
        .padding()
    }
    
    func runCode() {
        output = "Starting Bun...\n"
        
        Task {
            output += "Calling bun_eval_async...\n"
            let exitCode = await bun.eval(code, workingDir: "/tmp")
            output += "Bun finished with exit code: \(exitCode)\n"
        }
    }
}
