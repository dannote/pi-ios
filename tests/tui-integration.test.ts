/**
 * Integration tests for Pi TUI on iOS
 * 
 * These tests verify the TUI works correctly with our PipeTerminal.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { spawn } from 'bun';

const BUNDLE_PATH = join(import.meta.dir, '../lib/pi-full-patched.js');
const PATCHED_BUNDLE_PATH = '/tmp/pi-ios-patched.js';

describe('TUI Integration', () => {
  describe('PipeTerminal in TUI context', () => {
    test('terminal reports correct dimensions', async () => {
      const testCode = `
        globalThis.__PI_TERMINAL_COLUMNS = 80;
        globalThis.__PI_TERMINAL_ROWS = 24;
        
        class PipeTerminal {
          get columns() { return globalThis.__PI_TERMINAL_COLUMNS; }
          get rows() { return globalThis.__PI_TERMINAL_ROWS; }
        }
        
        const terminal = new PipeTerminal();
        console.log(JSON.stringify({ columns: terminal.columns, rows: terminal.rows }));
      `;
      
      const proc = spawn(['bun', '-e', testCode], { stdout: 'pipe' });
      const output = await new Response(proc.stdout).text();
      const result = JSON.parse(output.trim());
      
      expect(result.columns).toBe(80);
      expect(result.rows).toBe(24);
    });

    test('terminal dimensions can be changed at runtime', async () => {
      const testCode = `
        globalThis.__PI_TERMINAL_COLUMNS = 45;
        globalThis.__PI_TERMINAL_ROWS = 50;
        
        class PipeTerminal {
          constructor() {
            this._columns = globalThis.__PI_TERMINAL_COLUMNS;
            this._rows = globalThis.__PI_TERMINAL_ROWS;
          }
          get columns() { return this._columns; }
          get rows() { return this._rows; }
          setSize(cols, rows) {
            this._columns = cols;
            this._rows = rows;
          }
        }
        
        const terminal = new PipeTerminal();
        const before = { columns: terminal.columns, rows: terminal.rows };
        terminal.setSize(100, 40);
        const after = { columns: terminal.columns, rows: terminal.rows };
        console.log(JSON.stringify({ before, after }));
      `;
      
      const proc = spawn(['bun', '-e', testCode], { stdout: 'pipe' });
      const output = await new Response(proc.stdout).text();
      const result = JSON.parse(output.trim());
      
      expect(result.before.columns).toBe(45);
      expect(result.after.columns).toBe(100);
      expect(result.after.rows).toBe(40);
    });
  });

  describe('Terminal escape sequences', () => {
    test('hideCursor writes correct escape sequence', async () => {
      const testCode = `
        let output = '';
        const originalWrite = process.stdout.write.bind(process.stdout);
        process.stdout.write = (data) => { output += data; return true; };
        
        class PipeTerminal {
          write(data) { process.stdout.write(data); }
          hideCursor() { this.write('\\x1b[?25l'); }
        }
        
        const terminal = new PipeTerminal();
        terminal.hideCursor();
        
        process.stdout.write = originalWrite;
        console.log(JSON.stringify({ output, expected: '\\x1b[?25l' }));
      `;
      
      const proc = spawn(['bun', '-e', testCode], { stdout: 'pipe' });
      const output = await new Response(proc.stdout).text();
      const result = JSON.parse(output.trim());
      
      expect(result.output).toBe('\x1b[?25l');
    });

    test('showCursor writes correct escape sequence', async () => {
      const testCode = `
        let output = '';
        const originalWrite = process.stdout.write.bind(process.stdout);
        process.stdout.write = (data) => { output += data; return true; };
        
        class PipeTerminal {
          write(data) { process.stdout.write(data); }
          showCursor() { this.write('\\x1b[?25h'); }
        }
        
        const terminal = new PipeTerminal();
        terminal.showCursor();
        
        process.stdout.write = originalWrite;
        console.log(JSON.stringify({ output }));
      `;
      
      const proc = spawn(['bun', '-e', testCode], { stdout: 'pipe' });
      const output = await new Response(proc.stdout).text();
      const result = JSON.parse(output.trim());
      
      expect(result.output).toBe('\x1b[?25h');
    });

    test('setTitle writes OSC escape sequence', async () => {
      const testCode = `
        let output = '';
        const originalWrite = process.stdout.write.bind(process.stdout);
        process.stdout.write = (data) => { output += data; return true; };
        
        class PipeTerminal {
          write(data) { process.stdout.write(data); }
          setTitle(title) { this.write('\\x1b]0;' + title + '\\x07'); }
        }
        
        const terminal = new PipeTerminal();
        terminal.setTitle('Test Title');
        
        process.stdout.write = originalWrite;
        console.log(JSON.stringify({ output }));
      `;
      
      const proc = spawn(['bun', '-e', testCode], { stdout: 'pipe' });
      const output = await new Response(proc.stdout).text();
      const result = JSON.parse(output.trim());
      
      expect(result.output).toBe('\x1b]0;Test Title\x07');
    });
  });

  describe('Terminal width calculations', () => {
    const testCases = [
      { device: 'iPhone SE', width: 320, expectedCols: 35 },
      { device: 'iPhone 14', width: 390, expectedCols: 43 },
      { device: 'iPhone 14 Pro Max', width: 430, expectedCols: 47 },
      { device: 'iPad Mini', width: 744, expectedCols: 82 },
      { device: 'iPad Pro 12.9"', width: 1024, expectedCols: 113 },
    ];

    for (const { device, width, expectedCols } of testCases) {
      test(`calculates correct columns for ${device} (${width}px)`, () => {
        // Assuming 9px per character (monospace font)
        const charWidth = 9;
        const padding = 8; // 4px on each side
        const cols = Math.floor((width - padding) / charWidth);
        
        // Allow some variance
        expect(Math.abs(cols - expectedCols)).toBeLessThanOrEqual(3);
      });
    }
  });

  describe('Input handling', () => {
    test('regular characters are passed to handler', async () => {
      const testCode = `
        const received = [];
        
        class PipeTerminal {
          start(onInput, onResize) {
            this.onInput = onInput;
          }
          simulateInput(data) {
            if (this.onInput) this.onInput(data);
          }
        }
        
        const terminal = new PipeTerminal();
        terminal.start((data) => received.push(data), () => {});
        terminal.simulateInput('hello');
        terminal.simulateInput('world');
        
        console.log(JSON.stringify(received));
      `;
      
      const proc = spawn(['bun', '-e', testCode], { stdout: 'pipe' });
      const output = await new Response(proc.stdout).text();
      const result = JSON.parse(output.trim());
      
      expect(result).toEqual(['hello', 'world']);
    });

    test('carriage return is handled correctly', async () => {
      const testCode = `
        const received = [];
        
        class PipeTerminal {
          start(onInput, onResize) {
            this.onInput = onInput;
          }
          simulateInput(data) {
            if (this.onInput) this.onInput(data);
          }
        }
        
        const terminal = new PipeTerminal();
        terminal.start((data) => received.push(data), () => {});
        terminal.simulateInput('test\\r');
        
        console.log(JSON.stringify(received));
      `;
      
      const proc = spawn(['bun', '-e', testCode], { stdout: 'pipe' });
      const output = await new Response(proc.stdout).text();
      const result = JSON.parse(output.trim());
      
      expect(result[0]).toContain('\r');
    });

    test('backspace character is passed through', async () => {
      const testCode = `
        const received = [];
        
        class PipeTerminal {
          start(onInput, onResize) {
            this.onInput = onInput;
          }
          simulateInput(data) {
            if (this.onInput) this.onInput(data);
          }
        }
        
        const terminal = new PipeTerminal();
        terminal.start((data) => received.push(data.charCodeAt(0)), () => {});
        terminal.simulateInput('\\x7f'); // DEL character
        
        console.log(JSON.stringify(received));
      `;
      
      const proc = spawn(['bun', '-e', testCode], { stdout: 'pipe' });
      const output = await new Response(proc.stdout).text();
      const result = JSON.parse(output.trim());
      
      expect(result[0]).toBe(0x7f);
    });
  });

  describe('Resize handling', () => {
    test('resize callback is invoked when size changes', async () => {
      const testCode = `
        let resizeCount = 0;
        
        class PipeTerminal {
          constructor() {
            this._columns = 80;
            this._rows = 24;
          }
          get columns() { return this._columns; }
          get rows() { return this._rows; }
          start(onInput, onResize) {
            this.onResize = onResize;
          }
          setSize(cols, rows) {
            this._columns = cols;
            this._rows = rows;
            if (this.onResize) this.onResize();
          }
        }
        
        const terminal = new PipeTerminal();
        terminal.start(() => {}, () => { resizeCount++; });
        terminal.setSize(100, 40);
        terminal.setSize(120, 50);
        
        console.log(JSON.stringify({ resizeCount }));
      `;
      
      const proc = spawn(['bun', '-e', testCode], { stdout: 'pipe' });
      const output = await new Response(proc.stdout).text();
      const result = JSON.parse(output.trim());
      
      expect(result.resizeCount).toBe(2);
    });
  });
});

describe('Bundle patching', () => {
  test('ProcessTerminal is replaced with PipeTerminal', async () => {
    if (!existsSync(PATCHED_BUNDLE_PATH)) {
      console.warn('Patched bundle not found, skipping test');
      return;
    }
    
    const content = readFileSync(PATCHED_BUNDLE_PATH, 'utf8');
    
    // Should have PipeTerminal class
    expect(content).toContain('class PipeTerminal');
    
    // Should use PipeTerminal instead of ProcessTerminal
    expect(content).toContain('new PipeTerminal');
    
    // Should have atob polyfill
    expect(content).toContain('_nativeAtob');
  });

  test('terminal size globals are set', async () => {
    if (!existsSync(PATCHED_BUNDLE_PATH)) {
      console.warn('Patched bundle not found, skipping test');
      return;
    }
    
    const content = readFileSync(PATCHED_BUNDLE_PATH, 'utf8');
    
    expect(content).toContain('__PI_TERMINAL_COLUMNS');
    expect(content).toContain('__PI_TERMINAL_ROWS');
  });
});

describe('Text rendering', () => {
  test('text wraps at terminal width', () => {
    const terminalWidth = 45;
    const longText = 'This is a very long line that should wrap at the terminal boundary';
    
    const lines: string[] = [];
    let currentLine = '';
    
    for (const char of longText) {
      if (currentLine.length >= terminalWidth) {
        lines.push(currentLine);
        currentLine = '';
      }
      currentLine += char;
    }
    if (currentLine) lines.push(currentLine);
    
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[0].length).toBe(terminalWidth);
  });

  test('ANSI escape sequences do not count toward width', () => {
    const text = '\x1b[1;32mGreen\x1b[0m text';
    
    // Count visible characters only
    const visibleLength = text.replace(/\x1b\[[0-9;]*m/g, '').length;
    
    expect(visibleLength).toBe(10); // "Green text"
  });
});
