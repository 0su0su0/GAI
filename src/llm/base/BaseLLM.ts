import type { Message, ToolDefinition, LLMResponse, LLMStreamChunk, LLMConfig, ContentBlock } from '../../core/types.js';

/**
 * BaseLLM - 모든 LLM provider의 기본 클래스
 *
 * 히스토리 관리:
 * - default 모드: 내부적으로 네이티브 포맷으로 히스토리 관리 (stateful)
 * - fast/vision 모드: sendOnce()로 1회성 호출만 제공 (stateless)
 */
export abstract class BaseLLM {
  constructor(protected config: LLMConfig) {}

  // ===== 히스토리 관리 (default 모드, stateful) =====

  /**
   * 유저 메시지 추가
   */
  abstract addUserMessage(content: string | ContentBlock[]): void;

  /**
   * 어시스턴트 메시지 추가
   */
  abstract addAssistantMessage(content: string): void;

  /**
   * 툴 결과 추가
   */
  abstract addToolResult(toolUseId: string, result: string): void;

  /**
   * 히스토리 초기화
   */
  abstract clearHistory(): void;

  /**
   * 메시지 전송 (내부 히스토리 사용)
   */
  abstract send(tools?: ToolDefinition[]): Promise<LLMResponse>;

  /**
   * 메시지 전송 - 스트리밍 (내부 히스토리 사용)
   */
  abstract stream(tools?: ToolDefinition[]): AsyncIterableIterator<LLMStreamChunk>;

  // ===== 1회성 호출 (fast/vision 모드, stateless) =====

  /**
   * 1회성 메시지 전송 (히스토리 사용 안함)
   */
  abstract sendOnce(messages: Message[], tools?: ToolDefinition[]): Promise<LLMResponse>;

  // ===== 유틸리티 =====

  /**
   * 설정 업데이트
   */
  updateConfig(config: Partial<LLMConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 현재 설정 조회
   */
  getConfig(): LLMConfig {
    return { ...this.config };
  }
}
