/**
 * Minimal iOS agent using pi-agent-core directly.
 * Uses iOS tools (just-bash) instead of process-spawning tools.
 */

import { Agent, type AgentTool, type AgentMessage, type AgentEvent } from "@mariozechner/pi-agent-core";
import { getModel } from "@mariozechner/pi-ai";
import { bashTool, grepTool, findTool, readTool, writeTool, lsTool, getFilesystem, resetBash } from "./ios-tools.js";

// Create iOS-compatible tool wrappers that match AgentTool interface
function createIOSTools(cwd: string): AgentTool<any>[] {
  const tools: AgentTool<any>[] = [
    {
      name: "bash",
      label: "bash",
      description: "Execute a bash command. Returns stdout, stderr, and exit code.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Bash command to execute" }
        },
        required: ["command"]
      },
      execute: async (_toolCallId: string, params: { command: string }) => {
        const result = await bashTool(params.command, { cwd });
        let output = result.stdout || "(no output)";
        if (result.exitCode !== 0) {
          output += `\n\nCommand exited with code ${result.exitCode}`;
          if (result.stderr) output += `\nstderr: ${result.stderr}`;
        }
        return { content: [{ type: "text", text: output }] };
      }
    },
    {
      name: "grep",
      label: "grep",
      description: "Search file contents for a pattern. Returns matching lines with file paths and line numbers.",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Search pattern" },
          path: { type: "string", description: "Directory or file to search (default: current directory)" },
          ignoreCase: { type: "boolean", description: "Case-insensitive search" },
          context: { type: "number", description: "Lines of context around matches" },
          limit: { type: "number", description: "Maximum matches to return" }
        },
        required: ["pattern"]
      },
      execute: async (_toolCallId: string, params: any) => {
        const result = await grepTool(params.pattern, params.path || cwd, {
          ignoreCase: params.ignoreCase,
          context: params.context,
          limit: params.limit
        });
        const output = result.matchCount > 0 ? result.output : "(no matches)";
        return { content: [{ type: "text", text: output }] };
      }
    },
    {
      name: "find",
      label: "find",
      description: "Search for files by glob pattern. Returns matching file paths.",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Glob pattern (e.g., '*.ts', '**/*.json')" },
          path: { type: "string", description: "Directory to search (default: current directory)" },
          limit: { type: "number", description: "Maximum results to return" }
        },
        required: ["pattern"]
      },
      execute: async (_toolCallId: string, params: any) => {
        const result = await findTool(params.pattern, params.path || cwd, {
          limit: params.limit
        });
        const output = result.files.length > 0 ? result.files.join("\n") : "(no files found)";
        return { content: [{ type: "text", text: output }] };
      }
    },
    {
      name: "read",
      label: "read",
      description: "Read the contents of a file. Supports offset and limit for large files.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to the file" },
          offset: { type: "number", description: "Line offset to start from" },
          limit: { type: "number", description: "Maximum lines to read" }
        },
        required: ["path"]
      },
      execute: async (_toolCallId: string, params: any) => {
        try {
          const result = await readTool(params.path.startsWith('/') ? params.path : `${cwd}/${params.path}`, {
            offset: params.offset,
            limit: params.limit
          });
          return { content: [{ type: "text", text: result.content || "(empty file)" }] };
        } catch (e: any) {
          throw new Error(`Failed to read ${params.path}: ${e.message}`);
        }
      }
    },
    {
      name: "write",
      label: "write",
      description: "Write content to a file. Creates the file if it doesn't exist.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to the file" },
          content: { type: "string", description: "Content to write" }
        },
        required: ["path", "content"]
      },
      execute: async (_toolCallId: string, params: any) => {
        const fullPath = params.path.startsWith('/') ? params.path : `${cwd}/${params.path}`;
        const result = await writeTool(fullPath, params.content);
        if (result.success) {
          return { content: [{ type: "text", text: `Successfully wrote to ${params.path}` }] };
        }
        throw new Error(`Failed to write to ${params.path}`);
      }
    },
    {
      name: "ls",
      label: "ls",
      description: "List directory contents.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Directory path (default: current directory)" },
          all: { type: "boolean", description: "Show hidden files" }
        },
        required: []
      },
      execute: async (_toolCallId: string, params: any) => {
        const result = await lsTool(params.path || cwd, {
          long: true,
          all: params.all
        });
        return { content: [{ type: "text", text: result.output || "(empty directory)" }] };
      }
    }
  ];
  
  return tools;
}

export interface IOSAgentOptions {
  /** Working directory (in virtual filesystem) */
  cwd?: string;
  /** API key for OpenRouter */
  apiKey: string;
  /** Model to use (default: anthropic/claude-3.5-haiku) */
  model?: string;
  /** System prompt */
  systemPrompt?: string;
  /** Callback for streaming text */
  onText?: (text: string) => void;
  /** Callback for tool calls */
  onToolCall?: (name: string, args: any) => void;
  /** Callback for tool results */
  onToolResult?: (name: string, result: string, isError: boolean) => void;
  /** Callback for errors */
  onError?: (error: Error) => void;
  /** Callback when agent finishes */
  onFinish?: () => void;
}

export class IOSAgent {
  private agent: Agent;
  private options: IOSAgentOptions;
  private unsubscribe: (() => void) | null = null;
  
  constructor(options: IOSAgentOptions) {
    this.options = options;
    const cwd = options.cwd || '/home/user';
    
    // Initialize just-bash filesystem
    resetBash();
    const bash = getFilesystem();
    
    // Create working directory
    bash.exec(`mkdir -p ${cwd}`);
    
    // Get model from OpenRouter
    const model = getModel('openrouter', options.model || 'anthropic/claude-3.5-haiku', {
      apiKey: options.apiKey,
    });
    
    this.agent = new Agent({
      initialState: {
        systemPrompt: options.systemPrompt || 'You are a helpful coding assistant.',
        model,
        thinkingLevel: 'off',
        tools: createIOSTools(cwd),
        messages: [],
      },
    });
    
    // Subscribe to events
    this.setupEventHandlers();
  }
  
  private setupEventHandlers() {
    const { onText, onToolCall, onToolResult, onError, onFinish } = this.options;
    
    this.unsubscribe = this.agent.subscribe((event: AgentEvent) => {
      switch (event.type) {
        case 'message_update':
          // Stream text as it comes in
          const msgEvent = event.assistantMessageEvent;
          if (msgEvent.type === 'text_delta') {
            onText?.(msgEvent.delta);
          }
          break;
          
        case 'tool_execution_start':
          onToolCall?.(event.toolName, event.args);
          break;
          
        case 'tool_execution_end':
          onToolResult?.(event.toolName, JSON.stringify(event.result), event.isError);
          break;
          
        case 'agent_end':
          onFinish?.();
          break;
      }
    });
  }
  
  async chat(message: string): Promise<string> {
    const { onError } = this.options;
    
    try {
      await this.agent.prompt(message);
      
      // Get the last assistant message
      const messages = this.agent.state.messages;
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.role === 'assistant') {
        const textContent = lastMessage.content.find((c: any) => c.type === 'text');
        return textContent?.text || '';
      }
      return '';
    } catch (error: any) {
      onError?.(error);
      throw error;
    }
  }
  
  getMessages(): AgentMessage[] {
    return this.agent.state.messages;
  }
  
  destroy() {
    this.unsubscribe?.();
  }
}

export { getFilesystem, resetBash };
