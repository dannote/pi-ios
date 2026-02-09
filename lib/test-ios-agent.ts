import { IOSAgent, getFilesystem } from "./ios-agent.js";

async function main() {
  // Get API key from environment
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("OPENROUTER_API_KEY not set");
    process.exit(1);
  }
  
  console.log("Creating iOS Agent...\n");
  
  const agent = new IOSAgent({
    apiKey,
    cwd: '/project',
    systemPrompt: `You are a helpful coding assistant. You can read and write files, run bash commands, and search code.
When asked to create files, use the write tool.
When asked to find or search, use grep or find tools.
Be concise.`,
    onText: (text) => process.stdout.write(text),
    onToolCall: (name, args) => console.log(`\n[Tool: ${name}]`, args),
    onToolResult: (name, result) => console.log(`[Result: ${name}]`, result.slice(0, 200) + (result.length > 200 ? '...' : '')),
    onError: (error) => console.error("\n[Error]", error.message),
    onFinish: () => console.log("\n[Done]\n"),
  });
  
  // Pre-populate some files
  const bash = getFilesystem();
  await bash.exec('mkdir -p /project/src');
  await bash.exec('echo "export const VERSION = \'1.0.0\';" > /project/src/version.ts');
  await bash.exec('echo "import { VERSION } from \'./version\';\nconsole.log(VERSION);" > /project/src/main.ts');
  await bash.exec('echo "# My Project\nA simple TypeScript project." > /project/README.md');
  
  console.log("Files created in /project:");
  const ls = await bash.exec('find /project -type f');
  console.log(ls.stdout);
  
  console.log("---\n");
  console.log("Asking agent: 'What files are in /project? List them and show the content of main.ts'\n");
  
  await agent.chat("What files are in /project? List them and show the content of main.ts");
}

main().catch(console.error);
