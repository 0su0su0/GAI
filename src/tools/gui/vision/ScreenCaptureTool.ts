/**
 * Screen Capture Tool
 * Captures the screen and returns base64 encoded image
 */

import robot from 'robotjs';
import { ToolBase } from '../../ToolBase.js';
import type { ToolResult, ToolInput, CaptureScreenInput, ScreenCaptureResult } from '../../../core/types.js';

/**
 * Tool for capturing screenshots
 */
export class ScreenCaptureTool extends ToolBase {
  readonly name = 'capture_screen';
  readonly description = 'Capture a screenshot of the entire screen or a specific region. Returns base64 encoded image.';
  readonly inputSchema = {
    type: 'object',
    properties: {
      region: {
        type: 'object',
        properties: {
          x: { type: 'number', description: 'X coordinate of the top-left corner' },
          y: { type: 'number', description: 'Y coordinate of the top-left corner' },
          width: { type: 'number', description: 'Width of the region' },
          height: { type: 'number', description: 'Height of the region' },
        },
        description: 'Region to capture. If not provided, captures the entire screen.',
      },
      format: {
        type: 'string',
        enum: ['png', 'jpeg'],
        description: 'Image format',
        default: 'png',
      },
    },
  };

  async execute(input: ToolInput): Promise<ToolResult> {
    const typedInput = input as CaptureScreenInput;

    try {
      this.validateInput(input);

      // Get screen size
      const screenSize = robot.getScreenSize();

      // Determine capture region
      const region = typedInput.region || {
        x: 0,
        y: 0,
        width: screenSize.width,
        height: screenSize.height,
      };

      // Capture screen
      const screenshot = robot.screen.capture(
        region.x,
        region.y,
        region.width,
        region.height
      );

      // Convert to base64
      // robotjs returns a Bitmap object with width, height, image (Buffer), byteWidth, bitsPerPixel, bytesPerPixel
      const imageBuffer = screenshot.image;
      const base64 = imageBuffer.toString('base64');

      const result: ScreenCaptureResult = {
        base64,
        width: screenshot.width,
        height: screenshot.height,
        timestamp: new Date().toISOString(),
        format: typedInput.format || 'png',
      };

      return {
        success: true,
        data: JSON.stringify(result),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Screen capture failed: ${message}`,
      };
    }
  }
}
