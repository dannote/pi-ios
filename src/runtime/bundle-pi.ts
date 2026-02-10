/**
 * Bundle script to create the iOS-compatible pi-coding-agent bundle.
 * 
 * This creates a single JS file that includes:
 * 1. atob polyfill (iOS JSC bug workaround)
 * 2. Full pi-coding-agent with all dependencies
 * 3. Additional exports from pi-ai and pi-tui
 * 
 * Usage: bun run src/runtime/bundle-pi.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

const PI_AGENT_PATH = join(
  process.env.HOME || '~',
  '.bun/install/global/node_modules/@mariozechner/pi-coding-agent'
);

const PI_AI_PATH = join(
  process.env.HOME || '~', 
  '.bun/install/global/node_modules/@mariozechner/pi-ai'
);

const PI_TUI_PATH = join(
  process.env.HOME || '~',
  '.bun/install/global/node_modules/@mariozechner/pi-tui'
);

const OUTPUT_DIR = join(import.meta.dir, '../../dist');
const OUTPUT_FILE = join(OUTPUT_DIR, 'pi-ios-bundle.js');

async function bundle() {
  console.log('Creating iOS Pi bundle...');
  
  // Create temp file for bundling
  const tempFile = '/tmp/pi-bundle-entry.ts';
  const entryContent = `
// Re-export everything from pi and pi-ai and pi-tui
export * from "${PI_AGENT_PATH}/dist/index.js";
export { getModel, getModels, getProviders } from "${PI_AI_PATH}/dist/models.js";
export { TUI, ProcessTerminal, Container } from "${PI_TUI_PATH}/dist/index.js";
`;
  
  writeFileSync(tempFile, entryContent);
  
  // Bundle with Bun
  const proc = Bun.spawn(['bun', 'build', tempFile, '--outfile', '/tmp/pi-bundle.js', '--target=bun']);
  await proc.exited;
  
  if (proc.exitCode !== 0) {
    throw new Error('Bundle failed');
  }
  
  // Read polyfill
  const polyfillPath = join(import.meta.dir, 'atob-polyfill-raw.js');
  const polyfill = `
// atob polyfill for iOS JSC
const _nativeAtob = globalThis.atob;
globalThis.atob = function(str) {
  try {
    return _nativeAtob(str);
  } catch (e) {
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
  
  // Read bundle
  const bundle = readFileSync('/tmp/pi-bundle.js', 'utf8');
  
  // Combine
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_FILE, polyfill + '\n' + bundle);
  
  const stats = Bun.file(OUTPUT_FILE);
  console.log(`Bundle created: ${OUTPUT_FILE}`);
  console.log(`Size: ${((await stats.size) / 1024 / 1024).toFixed(2)} MB`);
}

bundle().catch(console.error);
