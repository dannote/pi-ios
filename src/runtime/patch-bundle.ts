/**
 * Patch the pi-coding-agent bundle for iOS
 * 
 * This script:
 * 1. Adds the atob polyfill
 * 2. Replaces ProcessTerminal with PipeTerminal
 * 3. Injects terminal size configuration
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const PIPE_TERMINAL_CODE = `
// PipeTerminal for iOS - replaces ProcessTerminal
class PipeTerminal {
  constructor() {
    this._columns = globalThis.__PI_TERMINAL_COLUMNS || 45;
    this._rows = globalThis.__PI_TERMINAL_ROWS || 50;
    this.inputHandler = null;
    this.resizeHandler = null;
    this._running = false;
    this._kittyProtocolActive = false;
  }

  get columns() { return this._columns; }
  get rows() { return this._rows; }
  get kittyProtocolActive() { return this._kittyProtocolActive; }

  setSize(columns, rows) {
    this._columns = columns;
    this._rows = rows;
    if (this.resizeHandler) this.resizeHandler();
  }

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
    try { process.stdin.pause(); } catch {}
  }

  write(data) {
    process.stdout.write(data);
  }

  hideCursor() {
    this.write('\\x1b[?25l');
  }

  showCursor() {
    this.write('\\x1b[?25h');
  }

  setTitle(title) {
    // Set terminal title via OSC escape sequence
    this.write('\\x1b]0;' + title + '\\x07');
  }

  // Additional methods that ProcessTerminal might have
  queryDeviceAttributes() {
    // No-op on iOS
  }

  enableAlternateScreen() {
    this.write('\\x1b[?1049h');
  }

  disableAlternateScreen() {
    this.write('\\x1b[?1049l');
  }
}
`;

const ATOB_POLYFILL = `
// atob polyfill for iOS JSC
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
`;

export function patchBundle(inputPath: string, outputPath: string, options: { columns?: number; rows?: number } = {}): void {
  const { columns = 45, rows = 50 } = options;
  
  console.log(`Reading bundle from ${inputPath}...`);
  let content = readFileSync(inputPath, 'utf8');
  
  // Count ProcessTerminal occurrences
  const matches = content.match(/new ProcessTerminal/g);
  console.log(`Found ${matches?.length || 0} ProcessTerminal instantiations`);
  
  // Replace ProcessTerminal class definition with PipeTerminal
  // The class is defined as: class ProcessTerminal { ... }
  // We need to replace it while keeping the export
  
  // Replace all "new ProcessTerminal" with "new PipeTerminal"
  content = content.replace(/new ProcessTerminal\b/g, 'new PipeTerminal');
  content = content.replace(/new ProcessTerminal2\b/g, 'new PipeTerminal');
  
  // Add terminal size config
  const sizeConfig = `
globalThis.__PI_TERMINAL_COLUMNS = ${columns};
globalThis.__PI_TERMINAL_ROWS = ${rows};
`;
  
  // Prepend polyfill, PipeTerminal class, and size config
  const patched = ATOB_POLYFILL + '\n' + sizeConfig + '\n' + PIPE_TERMINAL_CODE + '\n' + content;
  
  console.log(`Writing patched bundle to ${outputPath}...`);
  writeFileSync(outputPath, patched);
  
  const sizeMB = (patched.length / 1024 / 1024).toFixed(2);
  console.log(`Done! Bundle size: ${sizeMB} MB`);
}

// CLI
if (import.meta.main) {
  const args = process.argv.slice(2);
  const inputPath = args[0] || join(import.meta.dir, '../../lib/test-pi-main.js');
  const outputPath = args[1] || '/tmp/pi-ios-patched.js';
  const columns = parseInt(args[2] || '45');
  const rows = parseInt(args[3] || '50');
  
  patchBundle(inputPath, outputPath, { columns, rows });
}
