// Pi Terminal iOS Entry Point
const fs = require('fs');

// iOS JSC atob() polyfill
if (typeof globalThis.atob !== 'function' || (() => { try { atob('YWE='); return false; } catch { return true; } })()) {
  globalThis.atob = function(data) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    data = String(data).replace(/[\s\xA0]+/g, '');
    if (data.length % 4 === 1) throw new Error('InvalidCharacterError');
    let output = '';
    for (let i = 0, bc = 0, bs = 0; i < data.length; i++) {
      const c = chars.indexOf(data.charAt(i));
      if (c === -1) throw new Error('InvalidCharacterError');
      if (c === 64) continue;
      bs = bc > 0 ? (bs * 64 + c) : c;
      if (bc++ >= 4) { bc = 0; output += String.fromCharCode(255 & (bs >> 16), 255 & (bs >> 8), 255 & bs); bs = 0; }
      else if (bc === 2) { output += String.fromCharCode((bs >> 4) & 255); bs &= 15; }
      else if (bc === 3) { output += String.fromCharCode((bs >> 2) & 255); bs &= 3; }
    }
    return output;
  };
}

// Get Documents dir from argv[2]
const docsDir = process.argv[2];
if (!docsDir) {
  process.stdout.write('\x1b[31mDocuments dir not passed (argv[2])\x1b[0m\r\n');
  process.exit(1);
}

// Read config FIRST - before importing bundle
const configPath = docsDir + '/pi-config.json';
let config;
try {
  const configData = fs.readFileSync(configPath, 'utf-8');
  config = JSON.parse(configData);
} catch (e) {
  process.stdout.write(`\x1b[31mCannot read config: ${configPath}\x1b[0m\r\n`);
  process.stdout.write(`\x1b[31m${e.message}\x1b[0m\r\n`);
  process.exit(1);
}

// Set terminal dimensions BEFORE importing bundle!
// PipeTerminal reads these at construction time
globalThis.__PI_TERMINAL_COLUMNS = config.terminalColumns || 80;
globalThis.__PI_TERMINAL_ROWS = config.terminalRows || 24;

// Also set on stdout for any code that reads from there
if (config.terminalColumns) process.stdout.columns = config.terminalColumns;
if (config.terminalRows) process.stdout.rows = config.terminalRows;

// Set environment from config
if (config.openrouterApiKey) process.env.OPENROUTER_API_KEY = config.openrouterApiKey;
if (config.model) process.env.PI_MODEL = config.model;
if (config.documentsDir) process.env.PI_DOCUMENTS_DIR = config.documentsDir;
if (config.agentDir) process.env.PI_CODING_AGENT_DIR = config.agentDir;
if (config.forceFullRender) process.env.PI_FORCE_FULL_RENDER = '1';
if (config.terminalColumns) process.env.PI_TERMINAL_COLUMNS = String(config.terminalColumns);
if (config.terminalRows) process.env.PI_TERMINAL_ROWS = String(config.terminalRows);

// Skip version check on iOS
process.env.PI_SKIP_VERSION_CHECK = '1';

// Use alternate screen mode
process.stdout.write('\x1b[?1049h');

async function main() {
  const bundlePath = 'file://' + docsDir + '/pi-ios-bundle.js';
  
  try {
    // Import bundle AFTER globals are set
    const pi = await import(bundlePath);
    const modelId = config.model || 'anthropic/claude-3.5-haiku';
    const model = pi.getModel('openrouter', modelId);
    if (!model) {
      process.stdout.write(`\x1b[31mModel not found: ${modelId}\x1b[0m\r\n`);
      process.exit(1);
    }
    
    const { session } = await pi.createAgentSession({
      model,
      thinkingLevel: 'off',
      sessionManager: pi.SessionManager.inMemory(),
    });
    
    const mode = new pi.InteractiveMode(session, {
      extensionsResult: { extensions: [], loadErrors: [] },
    });
    
    await mode.run();
  } catch (error) {
    process.stdout.write(`\x1b[31mError: ${error.message}\x1b[0m\r\n`);
    if (error.stack) process.stdout.write(error.stack.replace(/\n/g, '\r\n') + '\r\n');
    process.exit(1);
  }
}

main().catch(err => {
  process.stdout.write(`\x1b[31mFatal: ${err}\x1b[0m\r\n`);
  process.exit(1);
});
