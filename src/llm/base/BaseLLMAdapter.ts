import type { Message, ToolDefinition, LLMResponse, LLMStreamChunk, LLMConfig } from '../../core/types.js';
import type { ILLMAdapter } from './types.js';
import { LLMError } from './types.js';

export abstract class BaseLLMAdapter implements ILLMAdapter {
  protected config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
    this.validateConfig();
  }

  // Abstract methods that each adapter must implement
  abstract send(messages: Message[], tools?: ToolDefinition[]): Promise<LLMResponse>;
  abstract stream(messages: Message[], tools?: ToolDefinition[]): AsyncIterableIterator<LLMStreamChunk>;

  // Common utility methods
  protected validateConfig(): void {
    if (!this.config.provider) {
      throw new LLMError('Provider not specified', 'unknown');
    }

    if (!this.config.apiKey && this.config.provider !== 'ollama') {
      throw new LLMError(`API key required for ${this.config.provider}`, this.config.provider);
    }
  }

  protected handleError(error: unknown): never {
    if (error instanceof LLMError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    const originalError = error instanceof Error ? error : undefined;

    throw new LLMError(
      `Error in ${this.config.provider}: ${message}`,
      this.config.provider,
      originalError
    );
  }

  protected getMaxTokens(): number {
    return this.config.maxTokens || 8096;
  }

  protected getTemperature(): number {
    return this.config.temperature ?? 0.7;
  }

  protected getModel(): string {
    return this.config.model || this.getDefaultModel();
  }

  protected abstract getDefaultModel(): string;
}
