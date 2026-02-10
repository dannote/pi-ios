/**
 * Tests for the Pi bundle loading and basic functionality
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { existsSync } from 'fs';
import { join } from 'path';

const BUNDLE_PATH = join(import.meta.dir, '../dist/pi-ios-bundle.js');
const LIB_BUNDLE_PATH = join(import.meta.dir, '../lib/pi-full-patched.js');

// Use whichever bundle exists
const bundlePath = existsSync(BUNDLE_PATH) ? BUNDLE_PATH : 
                   existsSync(LIB_BUNDLE_PATH) ? LIB_BUNDLE_PATH : 
                   '/tmp/pi-full.js';

describe('Pi bundle', () => {
  let pi: any;

  beforeAll(async () => {
    if (!existsSync(bundlePath)) {
      console.warn(`Bundle not found at ${bundlePath}, skipping tests`);
      return;
    }
    
    // Install atob polyfill first
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
    
    pi = await import(bundlePath);
  });

  describe('exports', () => {
    test('exports createAgentSession', () => {
      if (!pi) return;
      expect(typeof pi.createAgentSession).toBe('function');
    });

    test('exports AuthStorage', () => {
      if (!pi) return;
      expect(typeof pi.AuthStorage).toBe('function');
    });

    test('exports ModelRegistry', () => {
      if (!pi) return;
      expect(typeof pi.ModelRegistry).toBe('function');
    });

    test('exports SessionManager', () => {
      if (!pi) return;
      expect(typeof pi.SessionManager).toBe('function');
    });

    test('exports getModel', () => {
      if (!pi) return;
      expect(typeof pi.getModel).toBe('function');
    });

    test('exports TUI', () => {
      if (!pi) return;
      expect(typeof pi.TUI).toBe('function');
    });

    test('exports InteractiveMode', () => {
      if (!pi) return;
      expect(typeof pi.InteractiveMode).toBe('function');
    });
  });

  describe('getModel', () => {
    test('returns OpenRouter Claude 3.5 Haiku model', () => {
      if (!pi) return;
      const model = pi.getModel('openrouter', 'anthropic/claude-3.5-haiku');
      expect(model).toBeDefined();
      expect(model.id).toBe('anthropic/claude-3.5-haiku');
      expect(model.provider).toBe('openrouter');
    });

    test('returns undefined for unknown model', () => {
      if (!pi) return;
      const model = pi.getModel('openrouter', 'unknown/model');
      expect(model).toBeUndefined();
    });
  });

  describe('SessionManager', () => {
    test('inMemory creates in-memory session manager', () => {
      if (!pi) return;
      const sm = pi.SessionManager.inMemory();
      expect(sm).toBeDefined();
    });
  });

  describe('AuthStorage', () => {
    test('can be instantiated', () => {
      if (!pi) return;
      const auth = new pi.AuthStorage();
      expect(auth).toBeDefined();
    });
  });

  describe('ModelRegistry', () => {
    test('can be instantiated with AuthStorage', () => {
      if (!pi) return;
      const auth = new pi.AuthStorage();
      const registry = new pi.ModelRegistry(auth);
      expect(registry).toBeDefined();
    });
  });
});
