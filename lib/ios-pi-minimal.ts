// Minimal Pi Agent for iOS using pi-agent-core + pi-ai
import { Agent } from "/Users/dannote/.bun/install/global/node_modules/@mariozechner/pi-agent-core/dist/agent.js";
import { getModel } from "/Users/dannote/.bun/install/global/node_modules/@mariozechner/pi-ai/dist/models.js";
import type { Tool, ToolResult } from "/Users/dannote/.bun/install/global/node_modules/@mariozechner/pi-agent-core/dist/types.js";

export { Agent, getModel };
export type { Tool, ToolResult };
