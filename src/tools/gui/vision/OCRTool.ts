/**
 * OCR Tool
 * Performs OCR on an image or the current screen
 */

import robot from 'robotjs';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { ToolBase } from '../../ToolBase.js';
import { OCRFactory } from '../../../utils/ocr/OCRFactory.js';
import type { ToolResult, ToolInput, OCRInput, OCRAnalysis } from '../../../core/types.js';

/**
 * Tool for performing OCR on images
 */
export class OCRTool extends ToolBase {
  readonly name = 'ocr';
  readonly description = 'Perform OCR (text recognition) on an image file or the current screen. Returns text with bounding boxes.';
  readonly inputSchema = {
    type: 'object',
    properties: {
      imagePath: {
        type: 'string',
        description: 'Path to the image file to analyze',
      },
      captureScreen: {
        type: 'boolean',
        description: 'If true, captures the current screen and performs OCR on it',
        default: false,
      },
    },
  };

  async execute(input: ToolInput): Promise<ToolResult> {
    const typedInput = input as OCRInput;

    try {
      this.validateInput(input);

      // Check if OCR is supported
      if (!OCRFactory.isSupported()) {
        return {
          success: false,
          error: 'OCR is not supported on this platform. Only macOS and Windows are supported.',
        };
      }

      const ocrProvider = OCRFactory.create();
      if (!ocrProvider) {
        return {
          success: false,
          error: 'Failed to create OCR provider',
        };
      }

      let imagePath = typedInput.imagePath;
      let tempFile: string | null = null;

      // If captureScreen is true, capture the screen first
      if (typedInput.captureScreen) {
        // Capture screen
        const screenSize = robot.getScreenSize();
        const screenshot = robot.screen.capture(0, 0, screenSize.width, screenSize.height);

        // Save to temp file
        tempFile = join(tmpdir(), `ocr-${Date.now()}.png`);

        // Convert bitmap to PNG (simplified - robotjs provides raw bitmap data)
        // We'll write the raw image buffer for now
        writeFileSync(tempFile, screenshot.image);
        imagePath = tempFile;
      }

      if (!imagePath) {
        return {
          success: false,
          error: 'Either imagePath or captureScreen must be provided',
        };
      }

      // Perform OCR
      const result: OCRAnalysis = await ocrProvider.analyze(imagePath);

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
        data: JSON.stringify(result),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `OCR failed: ${message}`,
      };
    }
  }
}
