/**
 * Tests for CPU usage - ensure we're not spinning in tight loops
 */

import { describe, test, expect } from 'bun:test';
import { PipeTerminal } from '../src/terminal/pipe-terminal';

describe('CPU usage', () => {
  describe('PipeTerminal idle behavior', () => {
    test('terminal does not spin CPU when idle', async () => {
      const terminal = new PipeTerminal();
      
      let inputCallCount = 0;
      let resizeCallCount = 0;
      
      terminal.start(
        () => { inputCallCount++; },
        () => { resizeCallCount++; }
      );
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));
      
      terminal.stop();
      
      // Input handler should not have been called (no input)
      expect(inputCallCount).toBe(0);
      
      // Resize handler might be called once at start, but not continuously
      expect(resizeCallCount).toBeLessThanOrEqual(1);
    });

    test('terminal responds to input without spinning', async () => {
      const terminal = new PipeTerminal();
      
      let callCount = 0;
      
      terminal.start(
        () => { callCount++; },
        () => {}
      );
      
      // Simulate some time passing
      await new Promise(resolve => setTimeout(resolve, 50));
      
      terminal.stop();
      
      // Should not have called input handler when no input was received
      expect(callCount).toBe(0);
    });
  });

  describe('Event-driven architecture', () => {
    test('uses event listeners not polling loops', () => {
      const terminal = new PipeTerminal();
      
      // The implementation should use process.stdin.on('data', ...) 
      // not a while loop or for-await loop
      
      // We can verify this by checking that starting the terminal
      // doesn't block
      const startTime = Date.now();
      
      terminal.start(() => {}, () => {});
      
      const elapsed = Date.now() - startTime;
      
      terminal.stop();
      
      // Start should return immediately (< 10ms)
      expect(elapsed).toBeLessThan(10);
    });
  });
});
