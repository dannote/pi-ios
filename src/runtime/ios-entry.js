/**
 * iOS Entry Point for Pi Terminal
 * 
 * This script is the entry point that runs on iOS.
 * It installs the atob polyfill, patches ProcessTerminal, and runs Pi.
 */

// Configuration - these will be replaced at build time
const CONFIG = {
  OPENROUTER_API_KEY: 'OPENROUTER_API_KEY_PLACEHOLDER',
  MODEL: 'anthropic/claude-3.5-haiku',
  COLUMNS: 45,
  ROWS: 50,
};

// Install atob polyfill for iOS JSC
const _nativeAtob = globalThis.atob;
globalThis.atob = function(str) {
  try {
    return _nativeAtob(str);
  } catch {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';
    str = String(str).replace(/=+$/, '');
    for (let i = 0; i < str.length; i += 4) {
      const a = chars.indexOf(str.charAt(i));
      const b = chars.indexOf(str.charAt(i + 1));
      const c = chars.indexOf(str.charAt(i + 2));
      const d = chars.indexOf(str.charAt(i + 3));
      const n = (a << 18) | (b << 12) | (c << 6) | d;
      output += String.fromCharCode((n >> 16) & 255);
      if (c !== 64) output += String.fromCharCode((n >> 8) & 255);
      if (d !== 64) output += String.fromCharCode(n & 255);
    }
    return output;
  }
};

// PipeTerminal implementation for iOS
class PipeTerminal {
  constructor() {
    this._columns = CONFIG.COLUMNS;
    this._rows = CONFIG.ROWS;
    this.inputHandler = null;
    this.resizeHandler = null;
    this._running = false;
    this._kittyProtocolActive = false;
  }

  get columns() { return this._columns; }
  get rows() { return this._rows; }
  get kittyProtocolActive() { return this._kittyProtocolActive; }

  start(onInput, onResize) {
    this.inputHandler = onInput;
    this.resizeHandler = onResize;
    this._running = true;

    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (data) => {
      if (this.inputHandler && this._running) {
        this.inputHandler(data);
      }
    });
    process.stdin.resume();
  }

  stop() {
    this._running = false;
    this.inputHandler = null;
    this.resizeHandler = null;
    process.stdin.pause();
  }

  write(data) {
    process.stdout.write(data);
  }

  hideCursor() {
    this.write('\x1b[?25l');
  }

  showCursor() {
    this.write('\x1b[?25h');
  }
}

// Main function
async function main() {
  try {
    // Set API key
    process.env.OPENROUTER_API_KEY = CONFIG.OPENROUTER_API_KEY;

    // Load pi bundle
    const pi = await import('/tmp/pi-full.js');

    // Get model
    const model = pi.getModel('openrouter', CONFIG.MODEL);
    if (!model) {
      throw new Error(`Model not found: ${CONFIG.MODEL}`);
    }

    // Create session
    const authStorage = new pi.AuthStorage();
    const modelRegistry = new pi.ModelRegistry(authStorage);

    const { session } = await pi.createAgentSession({
      sessionManager: pi.SessionManager.inMemory(),
      authStorage,
      modelRegistry,
      model,
    });

    // Create TUI with our PipeTerminal
    const terminal = new PipeTerminal();
    const tui = new pi.TUI(terminal, true);

    // We can't use InteractiveMode directly because it creates its own TUI
    // Instead, let's create a simple REPL that uses the session
    
    console.log('\x1b[1;36mPi\x1b[0m — AI Coding Agent on iOS');
    console.log('\x1b[90mModel: ' + model.id + '\x1b[0m\n');

    // Subscribe to events
    session.subscribe((event) => {
      if (event.type === 'message_update') {
        const e = event.assistantMessageEvent;
        if (e.type === 'text_delta') {
          process.stdout.write(e.delta);
        } else if (e.type === 'tool_use_start') {
          console.log('\n\x1b[33m[' + e.name + ']\x1b[0m');
        }
      }
    });

    // Simple REPL
    const write = (s) => process.stdout.write(s);
    const print = (s) => write(s + '\n');

    write('\x1b[1;32mYou:\x1b[0m ');
    let buffer = '';

    process.stdin.setEncoding('utf8');
    process.stdin.on('data', async (data) => {
      for (const char of data) {
        if (char === '\r' || char === '\n') {
          print('');
          const line = buffer.trim();
          buffer = '';
          
          if (line === 'exit' || line === 'quit') {
            print('Goodbye!');
            process.exit(0);
          }
          
          if (line) {
            try {
              await session.prompt(line);
            } catch (e) {
              print('\x1b[31mError: ' + e.message + '\x1b[0m');
            }
            print('');
          }
          write('\x1b[1;32mYou:\x1b[0m ');
        } else if (char === '\x7f' || char === '\b') {
          if (buffer.length > 0) {
            buffer = buffer.slice(0, -1);
            write('\b \b');
          }
        } else if (char >= ' ' || char === '\t') {
          buffer += char;
          write(char);
        }
      }
    });
    process.stdin.resume();

  } catch (e) {
    console.error('ERROR:', e.message);
    console.error('Stack:', e.stack);
    process.exit(1);
  }
}

main();
