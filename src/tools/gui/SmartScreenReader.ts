import { ToolBase } from '../ToolBase.js';
import type { ToolResult, ToolInput } from '../../core/types.js';
import type { LLMManager } from '../../llm/LLMManager.js';

/**
 * Smart Screen Reader - 모드별 LLM 활용 예시
 * - fast mode: 빠른 화면 정보 추출
 * - vision mode: 상세한 이미지 분석
 */
export class SmartScreenReaderTool extends ToolBase {
  private llmManager?: LLMManager;

  readonly name = 'smart_screen_reader';
  readonly description = 'Captures and analyzes screen using appropriate LLM mode. Use vision mode for detailed analysis.';
  readonly inputSchema = {
    type: 'object',
    properties: {
      mode: {
        type: 'string',
        enum: ['quick', 'detailed'],
        description: 'Quick mode uses fast mode, detailed mode uses vision mode',
      },
    },
    required: ['mode'],
  };

  constructor(llmManager?: LLMManager) {
    super();
    this.llmManager = llmManager;
  }

  async execute(input: ToolInput): Promise<ToolResult> {
    const typedInput = input as { mode?: 'quick' | 'detailed' };
    try {
      this.validateInput(input);

      if (!typedInput.mode) {
        throw new Error('mode required: must be "quick" or "detailed"');
      }
      const mode = typedInput.mode;

      // Placeholder: 실제로는 화면 캡처
      const screenData = {
        timestamp: new Date().toISOString(),
        resolution: { width: 1920, height: 1080 },
        mode,
      };

      if (!this.llmManager) {
        return {
          success: true,
          data: {
            ...screenData,
            message: 'LLM Manager not available, returning basic info',
          },
        };
      }

      // Quick mode: fast mode (빠르고 저렴)
      if (mode === 'quick') {
        const response = await this.llmManager.sendWithMode('fast', [
          {
            role: 'user',
            content: 'Quickly summarize this screen: [placeholder screen data]',
          },
        ]);

        return {
          success: true,
          data: JSON.stringify({
            ...screenData,
            mode: 'fast',
            analysis: response.content,
          }),
        };
      }

      // Detailed mode: vision mode (상세 분석)
      const response = await this.llmManager.sendWithMode('vision', [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analyze this screen in detail. List all UI elements, their positions, and suggest interactions.',
            },
            // TODO: 실제 이미지 추가
            // {
            //   type: 'image',
            //   source: { type: 'base64', data: screenshot.base64, media_type: 'image/png' }
            // }
          ],
        },
      ]);

      return {
        success: true,
        data: JSON.stringify({
          ...screenData,
          mode: 'vision',
          analysis: response.content,
        }),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: message,
      };
    }
  }
}
