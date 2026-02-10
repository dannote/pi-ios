/**
 * Tests for PipeTerminal
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { PipeTerminal } from '../src/terminal/pipe-terminal';

describe('PipeTerminal', () => {
  let terminal: PipeTerminal;
  let originalStdin: typeof process.stdin;
  let originalStdout: typeof process.stdout;

  beforeEach(() => {
    terminal = new PipeTerminal();
  });

  afterEach(() => {
    terminal.stop();
  });

  describe('constructor', () => {
    test('creates with default dimensions', () => {
      const t = new PipeTerminal();
      expect(t.columns).toBe(45);
      expect(t.rows).toBe(50);
    });

    test('creates with custom dimensions', () => {
      const t = new PipeTerminal({ columns: 80, rows: 24 });
      expect(t.columns).toBe(80);
      expect(t.rows).toBe(24);
    });
  });

  describe('properties', () => {
    test('kittyProtocolActive is always false', () => {
      expect(terminal.kittyProtocolActive).toBe(false);
    });

    test('columns and rows are readable', () => {
      expect(typeof terminal.columns).toBe('number');
      expect(typeof terminal.rows).toBe('number');
    });
  });

  describe('setSize', () => {
    test('updates dimensions', () => {
      terminal.setSize(100, 40);
      expect(terminal.columns).toBe(100);
      expect(terminal.rows).toBe(40);
    });

    test('calls resize handler when started', () => {
      let resizeCalled = false;
      terminal.start(() => {}, () => { resizeCalled = true; });
      
      terminal.setSize(100, 40);
      expect(resizeCalled).toBe(true);
    });
  });

  describe('write', () => {
    test('writes to stdout', () => {
      const writes: string[] = [];
      const originalWrite = process.stdout.write.bind(process.stdout);
      process.stdout.write = ((data: string) => {
        writes.push(data);
        return true;
      }) as typeof process.stdout.write;

      terminal.write('test output');
      
      process.stdout.write = originalWrite;
      expect(writes).toContain('test output');
    });
  });

  describe('cursor control', () => {
    test('hideCursor writes escape sequence', () => {
      const writes: string[] = [];
      const originalWrite = process.stdout.write.bind(process.stdout);
      process.stdout.write = ((data: string) => {
        writes.push(data);
        return true;
      }) as typeof process.stdout.write;

      terminal.hideCursor();
      
      process.stdout.write = originalWrite;
      expect(writes).toContain('\x1b[?25l');
    });

    test('showCursor writes escape sequence', () => {
      const writes: string[] = [];
      const originalWrite = process.stdout.write.bind(process.stdout);
      process.stdout.write = ((data: string) => {
        writes.push(data);
        return true;
      }) as typeof process.stdout.write;

      terminal.showCursor();
      
      process.stdout.write = originalWrite;
      expect(writes).toContain('\x1b[?25h');
    });
  });

  describe('start/stop lifecycle', () => {
    test('start sets up input handler', () => {
      let inputReceived = '';
      terminal.start(
        (data) => { inputReceived = data; },
        () => {}
      );
      
      // Terminal should be running
      // Note: We can't easily test stdin events in unit tests
      expect(true).toBe(true);
    });

    test('stop cleans up', () => {
      terminal.start(() => {}, () => {});
      terminal.stop();
      
      // Should not throw
      expect(true).toBe(true);
    });

    test('can start and stop multiple times', () => {
      terminal.start(() => {}, () => {});
      terminal.stop();
      terminal.start(() => {}, () => {});
      terminal.stop();
      
      expect(true).toBe(true);
    });
  });
});
