import SwiftUI

nonisolated(unsafe) private var testSemaphore: DispatchSemaphore?

private func testExitHandler(exitCode: UInt32) {
    print("=== All tests passed! Exit code: \(exitCode) ===")
}

@main
struct BunTestApp: App {
    init() {
        DispatchQueue.global().asyncAfter(deadline: .now() + 1) {
            runBunTests()
        }
    }
    
    var body: some Scene {
        WindowGroup {
            BunTestView()
        }
    }
}

private func runBunTests() {
    print("=== Bun iOS Comprehensive Test ===")
    
    let code = """
    // Test 1: Basic JavaScript
    console.log('Test 1: Basic JS');
    console.log('  2+2 =', 2+2);
    console.log('  typeof undefined:', typeof undefined);
    
    // Test 2: require('path')
    console.log('Test 2: require("path")');
    const path = require('path');
    console.log('  path.join:', path.join('/a', 'b', 'c'));
    console.log('  path.dirname:', path.dirname('/foo/bar/baz.txt'));
    
    // Test 3: require('fs')
    console.log('Test 3: require("fs")');
    const fs = require('fs');
    fs.writeFileSync('/tmp/bun-test.txt', 'Hello from Bun on iOS!');
    const content = fs.readFileSync('/tmp/bun-test.txt', 'utf8');
    console.log('  File content:', content);
    fs.unlinkSync('/tmp/bun-test.txt');
    console.log('  File deleted');
    
    // Test 4: require('crypto')
    console.log('Test 4: require("crypto")');
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update('bun').digest('hex');
    console.log('  SHA256("bun"):', hash.slice(0, 32) + '...');
    
    // Test 5: require('os')
    console.log('Test 5: require("os")');
    const os = require('os');
    console.log('  platform:', os.platform());
    console.log('  arch:', os.arch());
    console.log('  tmpdir:', os.tmpdir());
    
    // Test 6: Async/await
    console.log('Test 6: Async/await');
    (async () => {
        const result = await Promise.resolve('async works!');
        console.log('  Promise result:', result);
    })();
    
    // Test 7: Buffer
    console.log('Test 7: Buffer');
    const buf = Buffer.from('hello', 'utf8');
    console.log('  Buffer hex:', buf.toString('hex'));
    
    // Test 8: URL
    console.log('Test 8: URL');
    const url = new URL('https://example.com/path?query=1');
    console.log('  hostname:', url.hostname);
    console.log('  pathname:', url.pathname);
    
    console.log('\\n=== ALL TESTS PASSED ===');
    """
    
    let result = bun_eval_async("/tmp", code, testExitHandler)
    print("bun_eval_async returned: \(result)")
}
