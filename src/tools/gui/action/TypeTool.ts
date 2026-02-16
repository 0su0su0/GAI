/**
 * Type Tool
 * Types text into the currently focused input field
 */

import { ToolBase } from '../../ToolBase.js';
import { KeyboardController } from '../../../utils/automation/KeyboardController.js';
import type { ToolResult, ToolInput, TypeTextInput } from '../../../core/types.js';

/**
 * Tool for typing text
 */
export class TypeTool extends ToolBase {
  readonly name = 'type_text';
  readonly description =
    'Type text into the currently focused input field. Can optionally press Enter after typing.';
  readonly inputSchema = {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'Text to type',
      },
      pressEnter: {
        type: 'boolean',
        description: 'Whether to press Enter after typing',
        default: false,
      },
      delay: {
        type: 'number',
        description: 'Delay in milliseconds between each character (default: 50ms)',
        default: 50,
      },
    },
    required: ['text'],
  };

  async execute(input: ToolInput): Promise<ToolResult> {
    const typedInput = input as TypeTextInput;

    try {
      this.validateInput(input);

      if (!typedInput.text) {
        return {
          success: false,
          error: 'text is required',
        };
      }

      const delay = typedInput.delay !== undefined ? typedInput.delay : 50;
      const pressEnter = typedInput.pressEnter || false;

      // Type the text
      KeyboardController.typeText(typedInput.text, delay);

      // Press Enter if requested
      if (pressEnter) {
        // Small delay before pressing Enter
        await new Promise((resolve) => setTimeout(resolve, 100));
        KeyboardController.pressEnter();
      }

      return {
        success: true,
        data: JSON.stringify({
          text: typedInput.text,
          length: typedInput.text.length,
          pressEnter,
          delay,
        }),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Type failed: ${message}`,
      };
    }
  }
}
