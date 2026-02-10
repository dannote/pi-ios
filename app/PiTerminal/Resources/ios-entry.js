const fs = require('fs');
const path = require('path');

// Write to both stdout and stderr
const log = (msg) => {
  console.log(msg);
  console.error(msg);
  process.stdout.write(msg + '\n');
  process.stderr.write(msg + '\n');
};

log('Entry start');

const documentsDir = process.argv[2] || process.env.PI_DOCUMENTS_DIR || '.';
log('Docs: ' + documentsDir);

const bundlePath = path.join(documentsDir, 'pi-ios-bundle.js');
log('Bundle: ' + bundlePath);
log('Exists: ' + fs.existsSync(bundlePath));

// Set env before loading
process.env.PI_SKIP_VERSION_CHECK = '1';
process.env.PI_NO_EXTENSIONS = '1';

log('API key present: ' + !!process.env.OPENROUTER_API_KEY);

try {
  log('Loading...');
  const pi = require(bundlePath);
  log('Loaded!');
  log('Keys: ' + Object.keys(pi).slice(0, 5).join(', '));
  
  const model = pi.getModel('openrouter', 'anthropic/claude-3.5-haiku');
  log('Model: ' + (model?.id || 'null'));
  
  pi.createAgentSession({
    model,
    thinkingLevel: 'off',
    sessionManager: pi.SessionManager.inMemory(),
  }).then(({ session }) => {
    log('Session ready');
    const mode = new pi.InteractiveMode(session, {
      extensionsResult: { extensions: [], loadErrors: [] },
    });
    mode.run().catch(e => log('Run error: ' + e.message));
  }).catch(e => log('Session error: ' + e.message));
} catch (e) {
  log('Error: ' + e.message);
}

setInterval(() => {}, 10000);
