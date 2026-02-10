/**
 * Minimal iOS agent using just fetch() - no heavy SDK dependencies.
 * This avoids the atob() issue in the OpenAI SDK on iOS.
 */

import { Bash } from "just-bash";

// Singleton bash instance
let bashInstance: Bash | null = null;

function getBash(): Bash {
  if (!bashInstance) {
    bashInstance = new Bash({ cwd: '/home/user' });
  }
  return bashInstance;
}

export function resetBash(): void {
  bashInstance = null;
}

export function getFilesystem(): Bash {
  return getBash();
}

// Tool definitions for Claude
const tools = [
  {
    name: "bash",
    description: "Execute a bash command. Returns stdout, stderr, and exit code.",
    input_schema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Bash command to execute" }
      },
      required: ["command"]
    }
  },
  {
    name: "read",
    description: "Read the contents of a file.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to the file" }
      },
      required: ["path"]
    }
  },
  {
    name: "write",
    description: "Write content to a file. Creates the file if it doesn't exist.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to the file" },
        content: { type: "string", description: "Content to write" }
      },
      required: ["path", "content"]
    }
  },
  {
    name: "ls",
    description: "List directory contents.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Directory path (default: current directory)" }
      },
      required: []
    }
  },
  {
    name: "grep",
    description: "Search file contents for a pattern.",
    input_schema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Search pattern" },
        path: { type: "string", description: "Directory or file to search" }
      },
      required: ["pattern"]
    }
  }
];

// Execute a tool
async function executeTool(name: string, input: any, cwd: string): Promise<string> {
  const bash = getBash();
  
  switch (name) {
    case "bash": {
      const result = await bash.exec(input.command, { cwd });
      let output = result.stdout || "(no output)";
      if (result.exitCode !== 0) {
        output += `\n\nCommand exited with code ${result.exitCode}`;
        if (result.stderr) output += `\nstderr: ${result.stderr}`;
      }
      return output;
    }
    
    case "read": {
      const result = await bash.exec(`cat '${input.path}'`, { cwd });
      return result.stdout || "(empty file)";
    }
    
    case "write": {
      const escaped = input.content.replace(/'/g, "'\\''");
      await bash.exec(`mkdir -p "$(dirname '${input.path}')"`, { cwd });
      const result = await bash.exec(`cat > '${input.path}' << 'EOFILE'\n${input.content}\nEOFILE`, { cwd });
      return result.exitCode === 0 ? `Successfully wrote to ${input.path}` : `Failed to write: ${result.stderr}`;
    }
    
    case "ls": {
      const path = input.path || cwd;
      const result = await bash.exec(`ls -la '${path}'`, { cwd });
      return result.stdout || "(empty directory)";
    }
    
    case "grep": {
      const path = input.path || cwd;
      const result = await bash.exec(`grep -rn '${input.pattern}' '${path}'`, { cwd });
      return result.stdout || "(no matches)";
    }
    
    default:
      return `Unknown tool: ${name}`;
  }
}

export interface AgentOptions {
  apiKey: string;
  cwd?: string;
  systemPrompt?: string;
  model?: string;
  onText?: (text: string) => void;
  onToolCall?: (name: string, input: any) => void;
  onToolResult?: (name: string, result: string) => void;
  onError?: (error: Error) => void;
}

export async function runAgent(message: string, options: AgentOptions): Promise<string> {
  const { apiKey, cwd = '/home/user', systemPrompt, model = 'anthropic/claude-3.5-haiku', onText, onToolCall, onToolResult, onError } = options;
  
  // Initialize bash and create cwd
  resetBash();
  const bash = getBash();
  await bash.exec(`mkdir -p '${cwd}'`);
  
  const messages: any[] = [
    { role: "user", content: message }
  ];
  
  let fullResponse = '';
  let iteration = 0;
  const maxIterations = 10;
  
  while (iteration < maxIterations) {
    iteration++;
    
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            ...messages
          ],
          tools: tools.map(t => ({
            type: 'function',
            function: {
              name: t.name,
              description: t.description,
              parameters: t.input_schema
            }
          })),
          tool_choice: 'auto',
          max_tokens: 4096
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      const assistantMessage = data.choices[0].message;
      
      // Handle text response
      if (assistantMessage.content) {
        fullResponse += assistantMessage.content;
        onText?.(assistantMessage.content);
      }
      
      // Check if done (no tool calls)
      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        break;
      }
      
      // Add assistant message with tool calls
      messages.push(assistantMessage);
      
      // Execute tool calls
      for (const toolCall of assistantMessage.tool_calls) {
        const name = toolCall.function.name;
        const input = JSON.parse(toolCall.function.arguments);
        
        onToolCall?.(name, input);
        
        const result = await executeTool(name, input, cwd);
        onToolResult?.(name, result);
        
        // Add tool result
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result
        });
      }
      
    } catch (error: any) {
      onError?.(error);
      throw error;
    }
  }
  
  return fullResponse;
}
