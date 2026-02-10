/**
 * atob polyfill for iOS JSC
 * 
 * iOS's JavaScriptCore has a buggy atob() that fails on valid base64 strings.
 * This polyfill wraps the native atob and falls back to a manual implementation.
 */

const nativeAtob = globalThis.atob;

function polyfillAtob(str: string): string {
  try {
    return nativeAtob(str);
  } catch {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';
    const cleaned = String(str).replace(/=+$/, '');
    
    for (let i = 0; i < cleaned.length; i += 4) {
      const a = chars.indexOf(cleaned.charAt(i));
      const b = chars.indexOf(cleaned.charAt(i + 1));
      const c = chars.indexOf(cleaned.charAt(i + 2));
      const d = chars.indexOf(cleaned.charAt(i + 3));
      const n = (a << 18) | (b << 12) | (c << 6) | d;
      
      output += String.fromCharCode((n >> 16) & 255);
      if (c !== 64) output += String.fromCharCode((n >> 8) & 255);
      if (d !== 64) output += String.fromCharCode(n & 255);
    }
    return output;
  }
}

export function installAtobPolyfill(): void {
  globalThis.atob = polyfillAtob;
}

export { polyfillAtob as atob };
