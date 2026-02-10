/**
 * Integration tests for Pi on iOS
 * 
 * These tests verify that all components work together correctly.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { existsSync } from 'fs';
import { join } from 'path';

const BUNDLE_PATH = join(import.meta.dir, '../lib/pi-full-patched.js');

describe('Pi iOS Integration', () => {
  let pi: any;

  beforeAll(async () => {
    if (!existsSync(BUNDLE_PATH) && !existsSync('/tmp/pi-full.js')) {
      console.warn('Bundle not found, skipping integration tests');
      return;
    }

    // Install atob polyfill
    const _nativeAtob = globalThis.atob;
    globalThis.atob = function(str: string) {
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

    const bundlePath = existsSync(BUNDLE_PATH) ? BUNDLE_PATH : '/tmp/pi-full.js';
    pi = await import(bundlePath);
  });

  describe('Session creation', () => {
    test('can create in-memory session', async () => {
      if (!pi) return;

      const authStorage = new pi.AuthStorage();
      const modelRegistry = new pi.ModelRegistry(authStorage);
      const model = pi.getModel('openrouter', 'anthropic/claude-3.5-haiku');

      const { session } = await pi.createAgentSession({
        sessionManager: pi.SessionManager.inMemory(),
        authStorage,
        modelRegistry,
        model,
      });

      expect(session).toBeDefined();
      expect(session.model?.id).toBe('anthropic/claude-3.5-haiku');
    });

    test('session has required methods', async () => {
      if (!pi) return;

      const authStorage = new pi.AuthStorage();
      const modelRegistry = new pi.ModelRegistry(authStorage);
      const model = pi.getModel('openrouter', 'anthropic/claude-3.5-haiku');

      const { session } = await pi.createAgentSession({
        sessionManager: pi.SessionManager.inMemory(),
        authStorage,
        modelRegistry,
        model,
      });

      expect(typeof session.prompt).toBe('function');
      expect(typeof session.subscribe).toBe('function');
      expect(typeof session.abort).toBe('function');
    });

    test('can subscribe to session events', async () => {
      if (!pi) return;

      const authStorage = new pi.AuthStorage();
      const modelRegistry = new pi.ModelRegistry(authStorage);
      const model = pi.getModel('openrouter', 'anthropic/claude-3.5-haiku');

      const { session } = await pi.createAgentSession({
        sessionManager: pi.SessionManager.inMemory(),
        authStorage,
        modelRegistry,
        model,
      });

      const events: any[] = [];
      const unsubscribe = session.subscribe((event: any) => {
        events.push(event);
      });

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });
  });

  describe('Model configuration', () => {
    test('OpenRouter models have correct baseUrl', () => {
      if (!pi) return;

      const model = pi.getModel('openrouter', 'anthropic/claude-3.5-haiku');
      expect(model.baseUrl).toBe('https://openrouter.ai/api/v1');
    });

    test('OpenRouter models have cost information', () => {
      if (!pi) return;

      const model = pi.getModel('openrouter', 'anthropic/claude-3.5-haiku');
      expect(model.cost).toBeDefined();
      expect(typeof model.cost.input).toBe('number');
      expect(typeof model.cost.output).toBe('number');
    });
  });
});

describe('PipeTerminal with TUI', () => {
  test.skip('TUI can be created with custom terminal', async () => {
    // This test is skipped because TUI initialization has side effects
    // that interfere with the test runner
  });
});
