/**
 * Click Tool
 * Clicks at coordinates or finds text via OCR and clicks it
 */

import { ToolBase } from '../../ToolBase.js';
import { MouseController } from '../../../utils/automation/MouseController.js';
import { OCRFactory } from '../../../utils/ocr/OCRFactory.js';
import type { ToolResult, ToolInput, ClickInput } from '../../../core/types.js';
import robot from 'robotjs';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Tool for clicking on screen elements
 */
export class ClickTool extends ToolBase {
  readonly name = 'click';
  readonly description =
    'Click at specific coordinates or search for text on screen and click it. Supports left, right, middle click and double-click.';
  readonly inputSchema = {
    type: 'object',
    properties: {
      x: {
        type: 'number',
        description: 'X coordinate to click',
      },
      y: {
        type: 'number',
        description: 'Y coordinate to click',
      },
      text: {
        type: 'string',
        description: 'Text to find via OCR and click on',
      },
      button: {
        type: 'string',
        enum: ['left', 'right', 'middle'],
        description: 'Mouse button to click',
        default: 'left',
      },
      doubleClick: {
        type: 'boolean',
        description: 'Whether to double-click',
        default: false,
      },
    },
  };

  async execute(input: ToolInput): Promise<ToolResult> {
    const typedInput = input as ClickInput;

    try {
      this.validateInput(input);

      const button = typedInput.button || 'left';
      const doubleClick = typedInput.doubleClick || false;

      // Mode 1: Click at specific coordinates
      if (typedInput.x !== undefined && typedInput.y !== undefined) {
        MouseController.clickAt(typedInput.x, typedInput.y, button, doubleClick);

        return {
          success: true,
          data: JSON.stringify({
            mode: 'coordinate',
            x: typedInput.x,
            y: typedInput.y,
            button,
            doubleClick,
          }),
        };
      }

      // Mode 2: Find text via OCR and click
      if (typedInput.text) {
        if (!OCRFactory.isSupported()) {
          return {
            success: false,
            error: 'OCR is not supported on this platform. Please provide x,y coordinates instead.',
          };
        }

        const ocrProvider = OCRFactory.create();
        if (!ocrProvider) {
          return {
            success: false,
            error: 'Failed to create OCR provider',
          };
        }

        // Capture screen
        const screenSize = robot.getScreenSize();
        const screenshot = robot.screen.capture(0, 0, screenSize.width, screenSize.height);

        // Save to temp file for OCR
        const tempFile = join(tmpdir(), `click-ocr-${Date.now()}.png`);
        writeFileSync(tempFile, screenshot.image);

        try {
          // Perform OCR
          const ocrResult = await ocrProvider.analyze(tempFile);

          // Find matching text (case-insensitive)
          const searchText = typedInput.text.toLowerCase();
          const matches = ocrResult.elements.filter((element) =>
            element.text.toLowerCase().includes(searchText)
          );

          if (matches.length === 0) {
            return {
              success: false,
              error: `Text "${typedInput.text}" not found on screen. Found ${ocrResult.elements.length} text elements but none matched.`,
            };
          }

          // Sort by confidence and take the best match
          const bestMatch = matches.sort((a, b) => b.confidence - a.confidence)[0];

          if (!bestMatch.bbox) {
            return {
              success: false,
              error: 'Text found but no bounding box available',
            };
          }

          // Click at the center of the bounding box
          MouseController.clickBBoxCenter(bestMatch.bbox, button, doubleClick);

          return {
            success: true,
            data: JSON.stringify({
              mode: 'ocr',
              text: typedInput.text,
              foundText: bestMatch.text,
              confidence: bestMatch.confidence,
              bbox: bestMatch.bbox,
              button,
              doubleClick,
            }),
          };
        } finally {
          // Clean up temp file
          try {
            unlinkSync(tempFile);
          } catch (e) {
            // Ignore cleanup errors
          }
        }
      }

      // Neither x,y nor text provided
      return {
        success: false,
        error: 'Either x,y coordinates or text must be provided',
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Click failed: ${message}`,
      };
    }
  }
}
