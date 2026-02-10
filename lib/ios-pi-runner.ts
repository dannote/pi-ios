// iOS Pi Agent Runner - uses real pi-agent-core
const { Agent, getModel } = await import("/tmp/ios-pi-minimal.js");
const { Bash } = await import("/tmp/just-bash.js");

const bash = new Bash();
const write = (s: string) => process.stdout.write(s);
const print = (s: string) => write(s + "\r\n");

print("\x1b[90mClaude 3.5 Haiku via OpenRouter\x1b[0m");
print("");

// Create tools
const tools = [
  {
    name: "bash",
    description: "Run a shell command",
    parameters: { type: "object", properties: { command: { type: "string" } }, required: ["command"] },
    execute: async (input: any) => {
      const r = await bash.exec(input.command);
      return { content: (r.stdout || "") + (r.stderr || "") || "(no output)" };
    },
  },
  {
    name: "read",
    description: "Read file contents", 
    parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
    execute: async (input: any) => {
      const r = await bash.exec(`cat '${input.path}'`);
      return r.exitCode === 0 ? { content: r.stdout } : { content: `Error: ${r.stderr}`, isError: true };
    },
  },
  {
    name: "write",
    description: "Write content to file",
    parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] },
    execute: async (input: any) => {
      await bash.exec(`cat > '${input.path}'`, { input: input.content });
      return { content: `Written: ${input.path}` };
    },
  },
];

// Create agent
const model = getModel("openrouter", "anthropic/claude-3.5-haiku");
const agent = new Agent({
  systemPrompt: "You are Pi, a helpful coding assistant on iOS. Be concise. Use tools to help.",
  model,
  tools,
});

// Subscribe to events
agent.subscribe((event: any) => {
  if (event.type === "text") {
    write(event.text.replace(/\n/g, "\r\n"));
  } else if (event.type === "toolStart") {
    print(`\r\n\x1b[33m[${event.name}]\x1b[0m ${JSON.stringify(event.input).slice(0, 50)}`);
  } else if (event.type === "toolResult") {
    const lines = (event.content || "").split("\n").slice(0, 5);
    print(`\x1b[90m${lines.join("\r\n")}\x1b[0m`);
  }
});

// REPL
write("\x1b[1;32mYou:\x1b[0m ");
let buffer = "";

for await (const chunk of Bun.stdin.stream()) {
  const text = new TextDecoder().decode(chunk);
  for (const char of text) {
    if (char === "\r" || char === "\n") {
      print("");
      const line = buffer.trim();
      buffer = "";
      if (line === "exit") process.exit(0);
      if (line) {
        await agent.prompt(line);
        print("");
      }
      write("\x1b[1;32mYou:\x1b[0m ");
    } else if (char === "\x7f") {
      if (buffer.length > 0) { buffer = buffer.slice(0, -1); write("\b \b"); }
    } else if (char >= " ") {
      buffer += char;
      write(char);
    }
  }
}
