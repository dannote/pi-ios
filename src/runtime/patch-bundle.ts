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
// Uses ABSOLUTE cursor positioning because Ghostty iOS has issues with relative movements
class PipeTerminal {
  constructor() {
    this._columns = globalThis.__PI_TERMINAL_COLUMNS || 45;
    this._rows = globalThis.__PI_TERMINAL_ROWS || 50;
    this.inputHandler = null;
    this.resizeHandler = null;
    this._running = false;
    this._kittyProtocolActive = false;
    // Track absolute cursor position (1-indexed as per ANSI standard)
    this._cursorRow = 1;
    this._cursorCol = 1;
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
    // Reset cursor tracking on start
    this._cursorRow = 1;
    this._cursorCol = 1;

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
    // Track cursor position changes from the data being written
    this._trackCursorFromOutput(data);
    process.stdout.write(data);
  }

  // Parse output to track cursor position
  _trackCursorFromOutput(data) {
    let i = 0;
    while (i < data.length) {
      const char = data[i];
      
      if (char === '\\x1b' && data[i + 1] === '[') {
        // Parse CSI sequence
        let j = i + 2;
        let params = '';
        while (j < data.length && /[0-9;]/.test(data[j])) {
          params += data[j];
          j++;
        }
        const cmd = data[j];
        
        if (cmd === 'H' || cmd === 'f') {
          // Cursor position: ESC[row;colH or ESC[row;colf
          const parts = params.split(';');
          this._cursorRow = parseInt(parts[0]) || 1;
          this._cursorCol = parseInt(parts[1]) || 1;
        } else if (cmd === 'A') {
          // Cursor up
          const n = parseInt(params) || 1;
          this._cursorRow = Math.max(1, this._cursorRow - n);
        } else if (cmd === 'B') {
          // Cursor down
          const n = parseInt(params) || 1;
          this._cursorRow = Math.min(this._rows, this._cursorRow + n);
        } else if (cmd === 'C') {
          // Cursor forward
          const n = parseInt(params) || 1;
          this._cursorCol = Math.min(this._columns, this._cursorCol + n);
        } else if (cmd === 'D') {
          // Cursor back
          const n = parseInt(params) || 1;
          this._cursorCol = Math.max(1, this._cursorCol - n);
        } else if (cmd === 'G') {
          // Cursor horizontal absolute
          this._cursorCol = parseInt(params) || 1;
        } else if (cmd === 'J' && params === '2') {
          // Clear screen - cursor goes to 1,1
          this._cursorRow = 1;
          this._cursorCol = 1;
        }
        
        i = j + 1;
        continue;
      }
      
      if (char === '\\r') {
        this._cursorCol = 1;
      } else if (char === '\\n') {
        this._cursorRow++;
        // Don't reset column on newline in raw mode
      } else if (char >= ' ') {
        // Printable character - advance column
        this._cursorCol++;
        if (this._cursorCol > this._columns) {
          this._cursorCol = 1;
          this._cursorRow++;
        }
      }
      
      i++;
    }
  }

  hideCursor() {
    this.write('\\x1b[?25l');
  }

  showCursor() {
    this.write('\\x1b[?25h');
  }

  setTitle(title) {
    this.write('\\x1b]0;' + title + '\\x07');
  }

  // Cursor movement - USE ABSOLUTE POSITIONING for Ghostty iOS compatibility
  moveBy(lines) {
    if (lines === 0) return;
    
    // Calculate target row
    const targetRow = Math.max(1, Math.min(this._rows, this._cursorRow + lines));
    
    // Use absolute positioning: ESC[row;1H
    process.stdout.write('\\x1b[' + targetRow + ';1H');
    this._cursorRow = targetRow;
    this._cursorCol = 1;
  }

  clearLine() {
    this.write('\\x1b[K');
  }

  clearFromCursor() {
    this.write('\\x1b[J');
  }

  clearScreen() {
    process.stdout.write('\\x1b[2J\\x1b[H');
    this._cursorRow = 1;
    this._cursorCol = 1;
  }

  async drainInput(maxMs = 1000, idleMs = 50) {
    await new Promise(resolve => setTimeout(resolve, Math.min(100, idleMs)));
  }

  queryDeviceAttributes() {}

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

export function patchBundle(inputPath: string, outputPath: string, options: { columns?: number; rows?: number; themesDir?: string } = {}): void {
  const { columns = 45, rows = 50, themesDir } = options;
  
  console.log(`Reading bundle from ${inputPath}...`);
  let content = readFileSync(inputPath, 'utf8');
  
  // Count ProcessTerminal occurrences
  const matches = content.match(/new ProcessTerminal/g);
  console.log(`Found ${matches?.length || 0} ProcessTerminal instantiations`);
  
  // Replace all "new ProcessTerminal" with "new PipeTerminal"
  content = content.replace(/new ProcessTerminal\b/g, 'new PipeTerminal');
  content = content.replace(/new ProcessTerminal2\b/g, 'new PipeTerminal');
  
  // Embed themes directly in the bundle to avoid filesystem dependencies
  let themesPatch = '';
  if (themesDir) {
    try {
      const darkTheme = readFileSync(join(themesDir, 'dark.json'), 'utf8');
      const lightTheme = readFileSync(join(themesDir, 'light.json'), 'utf8');
      themesPatch = `
// Embedded themes for iOS - override getBuiltinThemes
var __PI_BUILTIN_THEMES = {
  dark: ${darkTheme},
  light: ${lightTheme}
};
`;
      // Replace the getBuiltinThemes function to return embedded themes
      content = content.replace(
        /function getBuiltinThemes\(\) \{[\s\S]*?return BUILTIN_THEMES;\s*\}/,
        `function getBuiltinThemes() { return __PI_BUILTIN_THEMES; }`
      );
      console.log('Embedded themes patched');
    } catch (e) {
      console.log('Warning: Could not embed themes:', e);
    }
  }
  
  // Add terminal size config
  const sizeConfig = `
globalThis.__PI_TERMINAL_COLUMNS = ${columns};
globalThis.__PI_TERMINAL_ROWS = ${rows};
`;
  
  // Prepend polyfill, PipeTerminal class, themes, and size config
  const patched = ATOB_POLYFILL + '\n' + sizeConfig + '\n' + themesPatch + '\n' + PIPE_TERMINAL_CODE + '\n' + content;
  
  console.log(`Writing patched bundle to ${outputPath}...`);
  writeFileSync(outputPath, patched);
  
  const sizeMB = (patched.length / 1024 / 1024).toFixed(2);
  console.log(`Done! Bundle size: ${sizeMB} MB`);
}

// CLI
if (import.meta.main) {
  const args = process.argv.slice(2);
  const inputPath = args[0] || join(import.meta.dir, '../../lib/test-pi-main.js');
  const outputPath = args[1] || join(import.meta.dir, '../../lib/pi-ios-bundle.js');
  const columns = parseInt(args[2] || '45');
  const rows = parseInt(args[3] || '80');
  
  // Default themes dir
  const themesDir = process.env.THEMES_DIR || 
    join(process.env.HOME || '', '.bun/install/global/node_modules/@mariozechner/pi-coding-agent/dist/modes/interactive/theme');
  
  patchBundle(inputPath, outputPath, { columns, rows, themesDir });
}
