/**
 * iOS TUI Entry Point for Pi Terminal
 * 
 * This runs the full Pi TUI with InteractiveMode.
 * The bundle must be patched with patch-bundle.ts first.
 */

import { existsSync } from 'fs';

// Configuration - replaced at build time
const CONFIG = {
  OPENROUTER_API_KEY: 'OPENROUTER_API_KEY_PLACEHOLDER',
  MODEL: 'anthropic/claude-3.5-haiku',
  BUNDLE_PATH: '/tmp/pi-ios-patched.js',
};

async function main() {
  try {
    console.log('iOS Pi TUI starting...');
    
    // Check bundle exists
    if (!existsSync(CONFIG.BUNDLE_PATH)) {
      console.log('ERROR: Bundle not found at', CONFIG.BUNDLE_PATH);
      console.log('Contents of /tmp:', require('fs').readdirSync('/tmp').filter(f => f.includes('pi')).join(', '));
      process.exit(1);
    }
    
    // Set API key
    process.env.OPENROUTER_API_KEY = CONFIG.OPENROUTER_API_KEY;
    
    // Skip version check on iOS
    process.env.PI_SKIP_VERSION_CHECK = '1';
    
    // Disable extensions on iOS (they need extra deps)
    process.env.PI_NO_EXTENSIONS = '1';

    // Load patched pi bundle
    console.log('Loading bundle...');
    const pi = await import(CONFIG.BUNDLE_PATH);

    // Get model
    const model = pi.getModel('openrouter', CONFIG.MODEL);
    if (!model) {
      throw new Error(`Model not found: ${CONFIG.MODEL}`);
    }
    console.log('Model:', model.id);

    // Create session
    const authStorage = new pi.AuthStorage();
    const modelRegistry = new pi.ModelRegistry(authStorage);

    const { session } = await pi.createAgentSession({
      sessionManager: pi.SessionManager.inMemory(),
      authStorage,
      modelRegistry,
      model,
    });

    console.log('Session created!');

    // Create InteractiveMode - will now use our PipeTerminal
    const interactive = new pi.InteractiveMode(session, {});

    console.log('Starting TUI...');
    
    // Run it
    await interactive.run();

  } catch (e) {
    console.error('ERROR:', e.message);
    console.error('Stack:', e.stack?.split('\\n').slice(0, 8).join('\\n'));
    process.exit(1);
  }
}

main();
