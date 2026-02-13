import { BaseLLM } from '../base/BaseLLM.js';
import type { Message, ToolDefinition, LLMResponse, LLMStreamChunk, LLMConfig, ContentBlock } from '../../core/types.js';

interface OllamaMessage {
  role: string;
  content: string;
}

interface OllamaResponse {
  message: OllamaMessage;
  done: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
}

interface OllamaStreamChunk {
  message?: {
    content: string;
  };
  done?: boolean;
}

/**
 * Ollama LLM 구현
 */
export class OllamaLLM extends BaseLLM {
  private history: OllamaMessage[] = [];

  constructor(config: LLMConfig) {
    super(config);
    if (!config.baseUrl) {
      throw new Error('Ollama base URL required');
    }
    if (!config.model) {
      throw new Error('Ollama model required');
    }
    if (config.maxTokens === undefined) {
      throw new Error('maxTokens required');
    }
    if (config.temperature === undefined) {
      throw new Error('temperature required');
    }
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
    // Ollama는 로컬 모델이라 정적 정의 불가
    // Fallback: 모델 이름에 'vision' 또는 'vl' 포함 시 multimodal
    return modelId.toLowerCase().includes('vision') || modelId.toLowerCase().includes('vl');
  }

  // ===== 내부 유틸리티 =====

  private convertContent(content: string | ContentBlock[]): string {
    if (typeof content === 'string') {
      return content;
    }

    return content.map((block) => {
      if (block.type === 'text') {
        return block.text;
      } else {
        return `[Image: ${block.source.type}]`;
      }
    }).join('\n');
  }

  private convertMessages(messages: Message[]): OllamaMessage[] {
    return messages.map((msg) => ({
      role: msg.role,
      content: this.convertContent(msg.content),
    }));
  }

  // ===== 내부 히스토리 사용 (default 모드) =====

  async send(_tools?: ToolDefinition[]): Promise<LLMResponse> {
    const modelId = this.config.model;
    if (!modelId) {
      throw new Error('Model ID required');
    }

    const response = await fetch(`${this.config.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelId,
        messages: this.history,
        stream: false,
        options: {
          temperature: this.config.temperature!,
          num_predict: this.config.maxTokens!,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json() as OllamaResponse;
    const content = data.message.content;

    // 응답을 히스토리에 자동 추가
    this.addAssistantMessage(content);

    return {
      content,
      stopReason: data.done ? 'end_turn' : 'max_tokens',
      usage: {
        inputTokens: data.prompt_eval_count || 0,
        outputTokens: data.eval_count || 0,
      },
    };
  }

  async *stream(_tools?: ToolDefinition[]): AsyncIterableIterator<LLMStreamChunk> {
    const modelId = this.config.model;
    if (!modelId) {
      throw new Error('Model ID required');
    }

    const response = await fetch(`${this.config.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelId,
        messages: this.history,
        stream: true,
        options: {
          temperature: this.config.temperature!,
          num_predict: this.config.maxTokens!,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter((line) => line.trim());

      for (const line of lines) {
        try {
          const data = JSON.parse(line) as OllamaStreamChunk;
          if (data.message?.content) {
            yield { type: 'content', content: data.message.content };
          }
          if (data.done) {
            yield { type: 'done' };
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }
  }

  // ===== 1회성 호출 (fast/vision 모드) =====

  async sendOnce(messages: Message[], _tools?: ToolDefinition[]): Promise<LLMResponse> {
    const modelId = this.config.model;
    if (!modelId) {
      throw new Error('Model ID required');
    }

    const ollamaMessages = this.convertMessages(messages);

    const response = await fetch(`${this.config.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelId,
        messages: ollamaMessages,
        stream: false,
        options: {
          temperature: this.config.temperature!,
          num_predict: this.config.maxTokens!,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json() as OllamaResponse;

    return {
      content: data.message.content,
      stopReason: data.done ? 'end_turn' : 'max_tokens',
      usage: {
        inputTokens: data.prompt_eval_count || 0,
        outputTokens: data.eval_count || 0,
      },
    };
  }
}
