import { runAgent, getFilesystem, resetBash } from "./ios-agent-lite.js";

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("OPENROUTER_API_KEY not set");
    process.exit(1);
  }
  
  console.log("Testing iOS Agent Lite...\n");
  
  // Create test files (runAgent will reset bash, so we pass setup via onToolCall)
  // Actually, let's modify the agent to accept initial files
  
  const result = await runAgent(
    "First, use bash to create these files:\n- /project/src/version.ts with content: export const VERSION = 1.0;\n- /project/src/main.ts with content: import { VERSION } from './version'; console.log(VERSION);\nThen list the files in /project and show main.ts content.",
    {
      apiKey,
      cwd: '/project',
      systemPrompt: 'You are a helpful coding assistant. Be concise. When creating files, use the write tool.',
      onText: (text) => process.stdout.write(text),
      onToolCall: (name, input) => console.log(`\n[Tool: ${name}]`, JSON.stringify(input)),
      onToolResult: (name, result) => console.log(`[Result] ${result.slice(0, 100)}...`),
      onError: (error) => console.error("\n[Error]", error.message),
    }
  );
  
  console.log("\n\n[Done]");
}

main().catch(console.error);
