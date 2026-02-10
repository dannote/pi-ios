/**
 * Tests for the bundle patching functionality
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { patchBundle } from '../src/runtime/patch-bundle';

const TEST_DIR = '/tmp/pi-patch-tests';
const TEST_INPUT = join(TEST_DIR, 'input.js');
const TEST_OUTPUT = join(TEST_DIR, 'output.js');

describe('patchBundle', () => {
  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterAll(() => {
    try {
      unlinkSync(TEST_INPUT);
      unlinkSync(TEST_OUTPUT);
    } catch {}
  });

  test('adds atob polyfill to bundle', () => {
    const inputContent = `
      const x = 1;
      new ProcessTerminal();
    `;
    writeFileSync(TEST_INPUT, inputContent);
    
    patchBundle(TEST_INPUT, TEST_OUTPUT, { columns: 45, rows: 50 });
    
    const output = readFileSync(TEST_OUTPUT, 'utf8');
    expect(output).toContain('_nativeAtob');
    expect(output).toContain('globalThis.atob');
  });

  test('adds PipeTerminal class', () => {
    const inputContent = `
      const x = 1;
      new ProcessTerminal();
    `;
    writeFileSync(TEST_INPUT, inputContent);
    
    patchBundle(TEST_INPUT, TEST_OUTPUT, { columns: 45, rows: 50 });
    
    const output = readFileSync(TEST_OUTPUT, 'utf8');
    expect(output).toContain('class PipeTerminal');
    expect(output).toContain('get columns()');
    expect(output).toContain('get rows()');
    expect(output).toContain('hideCursor()');
    expect(output).toContain('showCursor()');
    expect(output).toContain('setTitle(');
  });

  test('replaces ProcessTerminal with PipeTerminal', () => {
    const inputContent = `
      const terminal = new ProcessTerminal();
      const ui = new TUI(new ProcessTerminal);
    `;
    writeFileSync(TEST_INPUT, inputContent);
    
    patchBundle(TEST_INPUT, TEST_OUTPUT, { columns: 45, rows: 50 });
    
    const output = readFileSync(TEST_OUTPUT, 'utf8');
    expect(output).toContain('new PipeTerminal');
    expect(output).not.toMatch(/new ProcessTerminal[^2]/); // Not replaced with ProcessTerminal2
  });

  test('sets terminal dimensions from options', () => {
    const inputContent = `const x = 1;`;
    writeFileSync(TEST_INPUT, inputContent);
    
    patchBundle(TEST_INPUT, TEST_OUTPUT, { columns: 80, rows: 24 });
    
    const output = readFileSync(TEST_OUTPUT, 'utf8');
    expect(output).toContain('__PI_TERMINAL_COLUMNS = 80');
    expect(output).toContain('__PI_TERMINAL_ROWS = 24');
  });

  test('uses default dimensions when not specified', () => {
    const inputContent = `const x = 1;`;
    writeFileSync(TEST_INPUT, inputContent);
    
    patchBundle(TEST_INPUT, TEST_OUTPUT, {});
    
    const output = readFileSync(TEST_OUTPUT, 'utf8');
    expect(output).toContain('__PI_TERMINAL_COLUMNS = 45');
    expect(output).toContain('__PI_TERMINAL_ROWS = 50');
  });

  test('preserves original bundle content', () => {
    const inputContent = `
      function myFunction() {
        return "original content";
      }
      export { myFunction };
    `;
    writeFileSync(TEST_INPUT, inputContent);
    
    patchBundle(TEST_INPUT, TEST_OUTPUT, { columns: 45, rows: 50 });
    
    const output = readFileSync(TEST_OUTPUT, 'utf8');
    expect(output).toContain('function myFunction()');
    expect(output).toContain('return "original content"');
    expect(output).toContain('export { myFunction }');
  });
});

describe('PipeTerminal methods', () => {
  test('PipeTerminal has all required methods', () => {
    const inputContent = `const x = 1;`;
    writeFileSync(TEST_INPUT, inputContent);
    
    patchBundle(TEST_INPUT, TEST_OUTPUT, { columns: 45, rows: 50 });
    
    const output = readFileSync(TEST_OUTPUT, 'utf8');
    
    const requiredMethods = [
      'get columns()',
      'get rows()',
      'get kittyProtocolActive()',
      'setSize(',
      'start(',
      'stop()',
      'write(',
      'hideCursor()',
      'showCursor()',
      'setTitle(',
    ];
    
    for (const method of requiredMethods) {
      expect(output).toContain(method);
    }
  });

  test('PipeTerminal reads dimensions from globals', () => {
    const inputContent = `const x = 1;`;
    writeFileSync(TEST_INPUT, inputContent);
    
    patchBundle(TEST_INPUT, TEST_OUTPUT, { columns: 45, rows: 50 });
    
    const output = readFileSync(TEST_OUTPUT, 'utf8');
    
    // Constructor should read from globals
    expect(output).toContain('globalThis.__PI_TERMINAL_COLUMNS');
    expect(output).toContain('globalThis.__PI_TERMINAL_ROWS');
  });
});

describe('atob polyfill', () => {
  test('polyfill handles valid base64', () => {
    const inputContent = `const x = 1;`;
    writeFileSync(TEST_INPUT, inputContent);
    
    patchBundle(TEST_INPUT, TEST_OUTPUT, { columns: 45, rows: 50 });
    
    const output = readFileSync(TEST_OUTPUT, 'utf8');
    
    // Should have the base64 character set
    expect(output).toContain('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=');
  });

  test('polyfill catches native atob errors', () => {
    const inputContent = `const x = 1;`;
    writeFileSync(TEST_INPUT, inputContent);
    
    patchBundle(TEST_INPUT, TEST_OUTPUT, { columns: 45, rows: 50 });
    
    const output = readFileSync(TEST_OUTPUT, 'utf8');
    
    // Should have try/catch around native call
    expect(output).toContain('try {');
    expect(output).toContain('catch');
  });
});
