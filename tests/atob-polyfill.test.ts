/**
 * Tests for atob polyfill
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { atob as polyfillAtob, installAtobPolyfill } from '../src/runtime/atob-polyfill';

describe('atob polyfill', () => {
  const testCases = [
    // OAuth client IDs from pi-ai (these fail on iOS native atob)
    {
      input: 'OWQxYzI1MGEtZTYxYi00NGQ5LTg4ZWQtNTk0NGQxOTYyZjVl',
      expected: '9d1c250a-e61b-44d9-88ed-5944d1962f5e',
      description: 'Anthropic client ID',
    },
    {
      input: 'SXYxLmI1MDdhMDhjODdlY2ZlOTg=',
      expected: 'Iv1.b507a08c87ecfe98',
      description: 'GitHub Copilot client ID',
    },
    {
      input: 'MTA3MTAwNjA2MDU5MS10bWhzc2luMmgyMWxjcmUyMzV2dG9sb2poNGc0MDNlcC5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbQ==',
      expected: '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com',
      description: 'Google Antigravity client ID',
    },
    // Simple cases
    {
      input: 'SGVsbG8gV29ybGQ=',
      expected: 'Hello World',
      description: 'Hello World',
    },
    {
      input: 'YWJj',
      expected: 'abc',
      description: 'Simple abc',
    },
    {
      input: '',
      expected: '',
      description: 'Empty string',
    },
    // With padding variations
    {
      input: 'YQ==',
      expected: 'a',
      description: 'Single char with padding',
    },
    {
      input: 'YWI=',
      expected: 'ab',
      description: 'Two chars with padding',
    },
  ];

  describe('polyfillAtob function', () => {
    for (const { input, expected, description } of testCases) {
      test(`decodes ${description}`, () => {
        const result = polyfillAtob(input);
        expect(result).toBe(expected);
      });
    }
  });

  describe('round-trip encoding', () => {
    // Note: btoa only works with Latin1 characters, not Unicode
    const strings = [
      'Hello, World!',
      '{"json": "data", "number": 123}',
      'Line1\nLine2\nLine3',
      'abcdefghijklmnopqrstuvwxyz0123456789',
    ];

    for (const str of strings) {
      test(`round-trips: ${str.slice(0, 20)}...`, () => {
        const encoded = btoa(str);
        const decoded = polyfillAtob(encoded);
        expect(decoded).toBe(str);
      });
    }
  });

  describe('installAtobPolyfill', () => {
    test('replaces global atob', () => {
      const originalAtob = globalThis.atob;
      installAtobPolyfill();
      
      // Should work with the test cases
      const result = globalThis.atob('SGVsbG8=');
      expect(result).toBe('Hello');
      
      // Restore original
      globalThis.atob = originalAtob;
    });
  });
});
