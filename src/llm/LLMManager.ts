import type { LLMConfig, LLMModeConfig, LLMMode, Message, ToolDefinition, LLMResponse, LLMStreamChunk, ContentBlock } from '../core/types.js';
import { BaseLLM } from './base/BaseLLM.js';
import { AnthropicLLM } from './providers/AnthropicLLM.js';
import { OpenAILLM } from './providers/OpenAILLM.js';
import { GoogleLLM } from './providers/GoogleLLM.js';
import { OllamaLLM } from './providers/OllamaLLM.js';

export class LLMManager {
  private defaultLLM: BaseLLM;
  private fastLLM?: BaseLLM;
  private visionLLM?: BaseLLM;
  private config: LLMConfig;
  private isModeEnabled: boolean;

  constructor(config: LLMConfig | LLMModeConfig) {
    this.isModeEnabled = this.isModeConfig(config);

    if (this.isModeEnabled) {
      // 모드별 설정
      const modeConfig = config as LLMModeConfig;
      this.config = modeConfig.default;
      this.defaultLLM = this.createLLM(modeConfig.default);
      this.fastLLM = this.createLLM(modeConfig.fast);
      this.visionLLM = this.createLLM(modeConfig.vision);
    } else {
      // 단일 설정
      this.config = config as LLMConfig;
      this.defaultLLM = this.createLLM(this.config);
    }
  }

  private isModeConfig(config: LLMConfig | LLMModeConfig): config is LLMModeConfig {
    return 'default' in config && 'fast' in config && 'vision' in config;
  }

  /**
   * Provider에 따라 적절한 LLM 클래스 인스턴스 생성
   */
  private createLLM(config: LLMConfig): BaseLLM {
    const provider = config.provider;

    switch (provider) {
      case 'anthropic':
        return new AnthropicLLM(config);
      case 'openai':
        return new OpenAILLM(config);
      case 'google':
        return new GoogleLLM(config);
      case 'ollama':
        return new OllamaLLM(config);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  // ===== 히스토리 관리 (default 모드) =====

  /**
   * 유저 메시지를 default LLM 히스토리에 추가
   */
  addUserMessage(content: string | ContentBlock[]): void {
    this.defaultLLM.addUserMessage(content);
  }

  /**
   * 어시스턴트 메시지를 default LLM 히스토리에 추가
   */
  addAssistantMessage(content: string): void {
    this.defaultLLM.addAssistantMessage(content);
  }

  /**
   * 툴 결과를 default LLM 히스토리에 추가
   */
  addToolResult(toolUseId: string, result: string): void {
    this.defaultLLM.addToolResult(toolUseId, result);
  }

  /**
   * default LLM 히스토리 초기화
   */
  clearHistory(): void {
    this.defaultLLM.clearHistory();
  }

  // ===== default 모드 호출 (내부 히스토리 사용) =====

  /**
   * Send messages to default LLM (uses internal history)
   */
  async send(tools?: ToolDefinition[]): Promise<LLMResponse> {
    try {
      return await this.defaultLLM.send(tools);
    } catch (error: unknown) {
      // Add retry logic for rate limits
      const message = error instanceof Error ? error.message : '';
      if (message.includes('rate limit')) {
        console.warn('Rate limited, waiting 1s and retrying...');
        await this.sleep(1000);
        return await this.defaultLLM.send(tools);
      }
      throw error;
    }
  }

  /**
   * Stream messages to default LLM (uses internal history)
   */
  async *stream(tools?: ToolDefinition[]): AsyncIterableIterator<LLMStreamChunk> {
    yield* this.defaultLLM.stream(tools);
  }

  // ===== fast/vision 모드 호출 (stateless, 1회성) =====

  /**
   * Send messages with specific mode
   * - default: uses internal history (stateful)
   * - fast/vision: stateless one-shot
   */
  async sendWithMode(mode: LLMMode, messages: Message[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    if (mode === 'default') {
      // default는 내부 히스토리 사용하지 않고 1회성으로도 사용 가능
      return await this.defaultLLM.sendOnce(messages, tools);
    }

    const llm = this.getLLMForMode(mode);
    try {
      return await llm.sendOnce(messages, tools);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('rate limit')) {
        console.warn('Rate limited, waiting 1s and retrying...');
        await this.sleep(1000);
        return await llm.sendOnce(messages, tools);
      }
      throw error;
    }
  }

  /**
   * Get LLM instance for specific mode
   */
  private getLLMForMode(mode: LLMMode): BaseLLM {
    if (mode === 'fast' && this.fastLLM) {
      return this.fastLLM;
    }
    if (mode === 'vision' && this.visionLLM) {
      return this.visionLLM;
    }
    // fallback: default LLM
    return this.defaultLLM;
  }

  /**
   * Get the current LLM instance (for DI into tools)
   * @param mode - Optional mode (default: 'default')
   */
  getAdapter(mode: LLMMode = 'default'): BaseLLM {
    return this.getLLMForMode(mode);
  }

  /**
   * Check if mode config is enabled
   */
  isModeConfigEnabled(): boolean {
    return this.isModeEnabled;
  }

  /**
   * Update configuration and recreate LLM
   */
  updateConfig(config: Partial<LLMConfig>): void {
    this.config = { ...this.config, ...config };
    this.defaultLLM = this.createLLM(this.config);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
