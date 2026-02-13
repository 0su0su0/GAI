import OpenAI from 'openai';
import { BaseLLM } from '../base/BaseLLM.js';
import type { Message, ToolDefinition, LLMResponse, LLMStreamChunk, LLMConfig, ToolCall, ContentBlock } from '../../core/types.js';

interface OpenAIContentBlock {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

interface OpenAIMessage {
  role: string;
  content: string | OpenAIContentBlock[];
}

interface OpenAITool {
  type: 'function';
  name: string;
  description: string;
  parameters: object;
}

/**
 * OpenAI LLM 구현
 *
 * 최신 모델 (2026-02):
 * - gpt-5.2 (가장 강력, multimodal)
 * - gpt-4.1 (안정 버전, multimodal)
 * - o4-mini (추론 모델, text-only, 저렴)
 */
export class OpenAILLM extends BaseLLM {
  private client: OpenAI;
  private history: OpenAIMessage[] = [];

  constructor(config: LLMConfig) {
    super(config);
    if (!config.apiKey) {
      throw new Error('OpenAI API key required');
    }
    if (!config.model) {
      throw new Error('OpenAI model required');
    }
    if (config.maxTokens === undefined) {
      throw new Error('maxTokens required');
    }
    if (config.temperature === undefined) {
      throw new Error('temperature required');
    }
    this.client = new OpenAI({ apiKey: config.apiKey });
  }

  // ===== 히스토리 관리 =====

  addUserMessage(content: string | ContentBlock[]): void {
    this.history.push({
      role: 'user',
      content: this.convertContent(content),
    });
  }

  addAssistantMessage(content: string): void {
    this.history.push({
      role: 'assistant',
      content,
    });
  }

  addToolResult(toolUseId: string, result: string): void {
    this.history.push({
      role: 'user',
      content: JSON.stringify({
        tool_use_id: toolUseId,
        type: 'tool_result',
        content: result,
      }),
    });
  }

  clearHistory(): void {
    this.history = [];
  }

  isMultimodal(modelId: string): boolean {
    // o-series (추론 모델)는 text-only, 나머지는 multimodal
    return !modelId.startsWith('o');
  }

  // ===== 내부 유틸리티 =====

  private convertContent(content: string | ContentBlock[]): string | OpenAIContentBlock[] {
    if (typeof content === 'string') {
      return content;
    }

    return content.map((block) => {
      if (block.type === 'text') {
        return { type: 'text' as const, text: block.text };
      } else {
        if (!block.source.media_type) {
          throw new Error('Image media_type required');
        }
        return {
          type: 'image_url' as const,
          image_url: {
            url: block.source.type === 'url'
              ? block.source.data
              : `data:${block.source.media_type};base64,${block.source.data}`,
          },
        };
      }
    });
  }

  private convertMessages(messages: Message[]): OpenAIMessage[] {
    return messages.map((msg) => ({
      role: msg.role,
      content: typeof msg.content === 'string' ? msg.content : this.convertContent(msg.content),
    }));
  }

  private convertTools(tools?: ToolDefinition[]): OpenAITool[] | undefined {
    return tools?.map((tool) => ({
      type: 'function' as const,
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    }));
  }

  // ===== 내부 히스토리 사용 (default 모드) =====

  async send(_tools?: ToolDefinition[]): Promise<LLMResponse> {
    const modelId = this.config.model;
    if (!modelId) {
      throw new Error('Model ID required');
    }

    const response = await (this.client as { responses: { create: (params: {
      model: string;
      max_tokens: number;
      temperature: number;
      input: OpenAIMessage[];
      tools?: OpenAITool[];
    }) => Promise<{
      output: Array<{ type: string; text?: string; call_id?: string; name?: string; arguments?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    }> } }).responses.create({
      model: modelId,
      max_tokens: this.config.maxTokens!,
      temperature: this.config.temperature!,
      input: this.history,
      tools: this.convertTools(_tools),
    });

    // Process output array
    let content = '';
    const toolCalls: ToolCall[] = [];

    for (const item of response.output) {
      if (item.type === 'text') {
        if (!item.text) {
          throw new Error('Text content missing in response');
        }
        content += item.text;
      } else if (item.type === 'function_call' && item.call_id && item.name && item.arguments) {
        toolCalls.push({
          id: item.call_id,
          name: item.name,
          input: JSON.parse(item.arguments),
        });
      }
    }

    // 응답을 히스토리에 자동 추가
    if (content) {
      this.addAssistantMessage(content);
    }

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      stopReason: toolCalls.length > 0 ? 'tool_use' : 'end_turn',
      usage: {
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
      },
    };
  }

  async *stream(_tools?: ToolDefinition[]): AsyncIterableIterator<LLMStreamChunk> {
    const modelId = this.config.model;
    if (!modelId) {
      throw new Error('Model ID required');
    }

    const stream = await (this.client as { responses: { create: (params: {
      model: string;
      max_tokens: number;
      temperature: number;
      input: OpenAIMessage[];
      tools?: OpenAITool[];
      stream: boolean;
    }) => Promise<AsyncIterable<{
      type: string;
      delta?: string;
      item?: { call_id?: string; name?: string; arguments?: string };
    }>> } }).responses.create({
      model: modelId,
      max_tokens: this.config.maxTokens!,
      temperature: this.config.temperature!,
      input: this.history,
      tools: this.convertTools(_tools),
      stream: true,
    });

    for await (const event of stream) {
      if (event.type === 'response.text.delta' && event.delta) {
        yield { type: 'content', content: event.delta };
      } else if (event.type === 'response.function_call_arguments.delta') {
        // Accumulate function call arguments
        continue;
      } else if (event.type === 'response.function_call_arguments.done' && event.item?.call_id && event.item?.name && event.item?.arguments) {
        yield {
          type: 'tool_use',
          toolCall: {
            id: event.item.call_id,
            name: event.item.name,
            input: JSON.parse(event.item.arguments),
          },
        };
      } else if (event.type === 'response.done') {
        yield { type: 'done' };
      }
    }
  }

  // ===== 1회성 호출 (fast/vision 모드) =====

  async sendOnce(messages: Message[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    const modelId = this.config.model;
    if (!modelId) {
      throw new Error('Model ID required');
    }

    const input = this.convertMessages(messages);

    const response = await (this.client as { responses: { create: (params: {
      model: string;
      max_tokens: number;
      temperature: number;
      input: OpenAIMessage[];
      tools?: OpenAITool[];
    }) => Promise<{
      output: Array<{ type: string; text?: string; call_id?: string; name?: string; arguments?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    }> } }).responses.create({
      model: modelId,
      max_tokens: this.config.maxTokens!,
      temperature: this.config.temperature!,
      input: input,
      tools: this.convertTools(tools),
    });

    // Process output array
    let content = '';
    const toolCalls: ToolCall[] = [];

    for (const item of response.output) {
      if (item.type === 'text') {
        if (!item.text) {
          throw new Error('Text content missing in response');
        }
        content += item.text;
      } else if (item.type === 'function_call' && item.call_id && item.name && item.arguments) {
        toolCalls.push({
          id: item.call_id,
          name: item.name,
          input: JSON.parse(item.arguments),
        });
      }
    }

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      stopReason: toolCalls.length > 0 ? 'tool_use' : 'end_turn',
      usage: {
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
      },
    };
  }
}
