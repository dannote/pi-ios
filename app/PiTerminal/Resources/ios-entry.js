import { existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';

const log = (msg) => {
  console.log(msg);
};

log('Entry start');

const documentsDir = process.argv[2] || process.env.PI_DOCUMENTS_DIR || '.';
log('Docs: ' + documentsDir);

// Bundle in Documents takes precedence, fallback to same dir as entry
const bundleInDocs = join(documentsDir, 'pi-ios-bundle.js');
const bundleInEntry = join(dirname(import.meta.path), 'pi-ios-bundle.js');
const bundlePath = existsSync(bundleInDocs) ? bundleInDocs : bundleInEntry;

log('Bundle: ' + bundlePath);
log('Exists: ' + existsSync(bundlePath));

// Set env
process.env.PI_SKIP_VERSION_CHECK = '1';
process.env.PI_NO_EXTENSIONS = '1';

log('API key: ' + (process.env.OPENROUTER_API_KEY ? 'set' : 'NOT SET'));

async function main() {
  try {
    log('Loading bundle...');
    // Bun requires file:// URL for absolute paths in dynamic import
    const importUrl = bundlePath.startsWith('/') ? `file://${bundlePath}` : new URL(bundlePath, import.meta.url).href;
    log('Import URL: ' + importUrl);
    const pi = await import(importUrl);
    log('Loaded! Keys: ' + Object.keys(pi).slice(0, 5).join(', '));
    
    const modelId = process.env.PI_MODEL || 'anthropic/claude-3.5-haiku';
    log('Getting model: ' + modelId);
    
    const model = pi.getModel('openrouter', modelId);
    if (!model) {
      log('ERROR: Model not found');
      process.exit(1);
    }
    log('Model found: ' + model.id);
    
    log('Creating session...');
    const { session } = await pi.createAgentSession({
      model,
      thinkingLevel: 'off',
      sessionManager: pi.SessionManager.inMemory(),
    });
    log('Session created');
    
    log('Starting TUI...');
    const mode = new pi.InteractiveMode(session, {
      extensionsResult: { extensions: [], loadErrors: [] },
    });
    
    await mode.run();
  } catch (e) {
    log('Error: ' + e.message);
    log('Stack: ' + (e.stack || '').substring(0, 500));
    process.exit(1);
  }
}

main();
