// Minimal streaming for OpenRouter - no OAuth dependencies
import type { Message, Tool, StreamEvent } from "/Users/dannote/.bun/install/global/node_modules/@mariozechner/pi-ai/dist/types.js";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

interface StreamOptions {
  model: string;
  messages: Message[];
  tools?: Tool[];
  systemPrompt?: string;
  onEvent: (event: StreamEvent) => void;
  signal?: AbortSignal;
}

export async function streamOpenRouter(options: StreamOptions): Promise<void> {
  const { model, messages, tools, systemPrompt, onEvent, signal } = options;
  
  // Convert messages to OpenAI format
  const openaiMessages: any[] = [];
  if (systemPrompt) {
    openaiMessages.push({ role: 'system', content: systemPrompt });
  }
  
  for (const msg of messages) {
    if (msg.role === 'user') {
      openaiMessages.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant') {
      const assistantMsg: any = { role: 'assistant' };
      if (msg.content) assistantMsg.content = msg.content;
      if (msg.toolCalls?.length) {
        assistantMsg.tool_calls = msg.toolCalls.map(tc => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.input) }
        }));
      }
      openaiMessages.push(assistantMsg);
    } else if (msg.role === 'toolResult') {
      openaiMessages.push({
        role: 'tool',
        tool_call_id: msg.toolCallId,
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
      });
    }
  }

  const openaiTools = tools?.map(t => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters
    }
  }));

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: openaiMessages,
      tools: openaiTools,
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} ${error}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentToolCall: any = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') continue;

      try {
        const json = JSON.parse(data);
        const delta = json.choices?.[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          onEvent({ type: 'text', text: delta.content });
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (tc.id) {
              if (currentToolCall) {
                onEvent({
                  type: 'toolStart',
                  id: currentToolCall.id,
                  name: currentToolCall.name,
                  input: JSON.parse(currentToolCall.arguments || '{}')
                });
              }
              currentToolCall = { id: tc.id, name: tc.function?.name || '', arguments: '' };
            }
            if (tc.function?.name) currentToolCall.name = tc.function.name;
            if (tc.function?.arguments) currentToolCall.arguments += tc.function.arguments;
          }
        }
      } catch {}
    }
  }

  if (currentToolCall) {
    onEvent({
      type: 'toolStart', 
      id: currentToolCall.id,
      name: currentToolCall.name,
      input: JSON.parse(currentToolCall.arguments || '{}')
    });
  }

  onEvent({ type: 'done' });
}
