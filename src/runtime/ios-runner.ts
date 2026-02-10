/**
 * iOS Pi Runner - Main entry point for Pi on iOS
 * 
 * This loads the pi-coding-agent bundle and runs it with a custom PipeTerminal.
 * We monkey-patch ProcessTerminal to use our pipe-based implementation.
 */

import { PipeTerminal } from '../terminal/pipe-terminal';

export interface iOSRunnerOptions {
  bundlePath: string;
  apiKey: string;
  model?: string;
  columns?: number;
  rows?: number;
}

export async function runPi(options: iOSRunnerOptions): Promise<void> {
  const {
    bundlePath,
    apiKey,
    model = 'anthropic/claude-3.5-haiku',
    columns = 45,
    rows = 50,
  } = options;

  // Set API key in environment
  process.env.OPENROUTER_API_KEY = apiKey;

  // Load the pi bundle
  const pi = await import(bundlePath);

  // Monkey-patch ProcessTerminal with our PipeTerminal
  // InteractiveMode creates: new TUI(new ProcessTerminal(), ...)
  // We need to replace ProcessTerminal before InteractiveMode is created
  const OriginalProcessTerminal = pi.ProcessTerminal;
  
  class PatchedProcessTerminal extends PipeTerminal {
    constructor() {
      super({ columns, rows });
    }
  }
  
  // Replace the export
  pi.ProcessTerminal = PatchedProcessTerminal;

  // Get model
  const modelConfig = pi.getModel('openrouter', model);
  if (!modelConfig) {
    throw new Error(`Model not found: ${model}`);
  }

  // Create session
  const authStorage = new pi.AuthStorage();
  const modelRegistry = new pi.ModelRegistry(authStorage);

  const { session } = await pi.createAgentSession({
    sessionManager: pi.SessionManager.inMemory(),
    authStorage,
    modelRegistry,
    model: modelConfig,
  });

  // Create InteractiveMode - it will now use our patched ProcessTerminal
  const interactive = new pi.InteractiveMode(session, {});

  // Run it
  await interactive.run();
}
