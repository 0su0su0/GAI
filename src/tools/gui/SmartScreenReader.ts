import robot from 'robotjs';
import { ToolBase } from '../ToolBase.js';
import type { ToolResult, ToolInput } from '../../core/types.js';
import type { LLMManager } from '../../llm/LLMManager.js';
import { OCRFactory } from '../../utils/ocr/OCRFactory.js';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

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
    let tempFile: string | null = null;

    try {
      this.validateInput(input);

      if (!typedInput.mode) {
        throw new Error('mode required: must be "quick" or "detailed"');
      }
      const mode = typedInput.mode;

      if (!this.llmManager) {
        return {
          success: false,
          error: 'LLM Manager not available',
        };
      }

      // Capture screen
      const screenSize = robot.getScreenSize();
      const screenshot = robot.screen.capture(0, 0, screenSize.width, screenSize.height);

      // Convert to base64
      const base64Image = screenshot.image.toString('base64');

      const screenData = {
        timestamp: new Date().toISOString(),
        resolution: { width: screenshot.width, height: screenshot.height },
        mode,
      };

      // Quick mode: fast mode without OCR (빠르고 저렴)
      if (mode === 'quick') {
        const response = await this.llmManager.sendWithMode('fast', [
          {
            role: 'user',
            content: `Quickly summarize the current screen state. Screen resolution: ${screenData.resolution.width}x${screenData.resolution.height}`,
          },
        ]);

        return {
          success: true,
          data: JSON.stringify({
            ...screenData,
            llmMode: 'fast',
            analysis: response.content,
          }),
        };
      }

      // Detailed mode: vision mode with OCR (상세 분석)
      // Perform OCR if supported
      let ocrData = null;
      if (OCRFactory.isSupported()) {
        try {
          const ocrProvider = OCRFactory.create();
          if (ocrProvider) {
            // Save screenshot to temp file for OCR
            tempFile = join(tmpdir(), `screen-${Date.now()}.png`);
            writeFileSync(tempFile, screenshot.image);

            // Perform OCR
            const ocrResult = await ocrProvider.analyze(tempFile);
            ocrData = ocrResult;
          }
        } catch (ocrError) {
          console.warn('OCR failed, continuing with vision-only analysis:', ocrError);
        }
      }

      // Prepare vision prompt
      const promptText = ocrData
        ? `Analyze this screen in detail. I've performed OCR and found the following text elements:\n\n${JSON.stringify(ocrData.elements.slice(0, 50), null, 2)}\n\nPlease identify all clickable UI elements with their exact coordinates based on the image and OCR data.`
        : 'Analyze this screen in detail. List all UI elements, their positions, and suggest interactions.';

      const response = await this.llmManager.sendWithMode('vision', [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: promptText,
            },
            {
              type: 'image',
              source: {
                type: 'base64',
                data: base64Image,
                media_type: 'image/png',
              },
            },
          ],
        },
      ]);

      // Clean up temp file
      if (tempFile) {
        try {
          unlinkSync(tempFile);
        } catch (e) {
          // Ignore cleanup errors
        }
      }

      return {
        success: true,
        data: JSON.stringify({
          ...screenData,
          llmMode: 'vision',
          ocrSupported: OCRFactory.isSupported(),
          ocrTextCount: ocrData?.elements.length || 0,
          analysis: response.content,
        }),
      };
    } catch (error: unknown) {
      // Clean up temp file on error
      if (tempFile) {
        try {
          unlinkSync(tempFile);
        } catch (e) {
          // Ignore cleanup errors
        }
      }

      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: message,
      };
    }
  }
}
