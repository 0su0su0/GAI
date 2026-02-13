import type { Message, ToolDefinition, LLMResponse, LLMStreamChunk, LLMConfig } from '../../core/types.js';

// ===== LLM Adapter Interface =====

export interface ILLMAdapter {
  send(messages: Message[], tools?: ToolDefinition[]): Promise<LLMResponse>;
  stream(messages: Message[], tools?: ToolDefinition[]): AsyncIterableIterator<LLMStreamChunk>;
}

// ===== Provider-specific Types =====

// Anthropic
export interface AnthropicConfig extends LLMConfig {
  provider: 'anthropic';
  model?: 'claude-3-5-sonnet-20241022' | 'claude-3-opus-20240229' | string;
}

// OpenAI
export interface OpenAIConfig extends LLMConfig {
  provider: 'openai';
  model?: 'gpt-5.2' | 'gpt-5.1' | 'gpt-5' | 'gpt-5-mini' | 'gpt-4.1' | 'gpt-4o' | 'o4-mini' | 'o3' | string;
}

// Google
export interface GoogleConfig extends LLMConfig {
  provider: 'google';
  model?: 'gemini-2.0-flash-exp' | 'gemini-1.5-pro' | 'gemini-1.5-flash' | string;
}

// Ollama
export interface OllamaConfig extends LLMConfig {
  provider: 'ollama';
  baseUrl: string;
  model: string;
}

// ===== Errors =====

export class LLMError extends Error {
  constructor(
    message: string,
    public provider: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

export class LLMRateLimitError extends LLMError {
  constructor(provider: string, public retryAfter?: number) {
    super(`Rate limit exceeded for ${provider}`, provider);
    this.name = 'LLMRateLimitError';
  }
}

export class LLMAuthError extends LLMError {
  constructor(provider: string) {
    super(`Authentication failed for ${provider}`, provider);
    this.name = 'LLMAuthError';
  }
}
