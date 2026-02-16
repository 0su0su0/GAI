/**
 * Key Press Tool
 * Presses keyboard keys with optional modifiers (Cmd, Ctrl, Alt, Shift)
 */

import { ToolBase } from '../../ToolBase.js';
import { KeyboardController } from '../../../utils/automation/KeyboardController.js';
import type { ToolResult, ToolInput, PressKeyInput } from '../../../core/types.js';

/**
 * Tool for pressing keyboard keys and shortcuts
 */
export class KeyPressTool extends ToolBase {
  readonly name = 'press_key';
  readonly description =
    'Press keyboard keys with optional modifiers. Supports shortcuts like Cmd+C, Ctrl+V, etc.';
  readonly inputSchema = {
    type: 'object',
    properties: {
      key: {
        description: 'Key or keys to press (e.g., "c", "enter", "tab")',
        oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
      },
      modifiers: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['command', 'ctrl', 'alt', 'shift'],
        },
        description: 'Modifier keys to hold while pressing the key',
      },
    },
    required: ['key'],
  };

  async execute(input: ToolInput): Promise<ToolResult> {
    const typedInput = input as PressKeyInput;

    try {
      this.validateInput(input);

      if (!typedInput.key) {
        return {
          success: false,
          error: 'key is required',
        };
      }

      const keys = Array.isArray(typedInput.key) ? typedInput.key : [typedInput.key];
      const modifiers = typedInput.modifiers || [];

      // Press the key combination
      KeyboardController.pressKey(typedInput.key, modifiers);

      // Format the key combination for display
      const keyCombo = [
        ...modifiers.map((m) => m.charAt(0).toUpperCase() + m.slice(1)),
        ...keys,
      ].join('+');

      return {
        success: true,
        data: JSON.stringify({
          keys: typedInput.key,
          modifiers,
          combination: keyCombo,
        }),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Key press failed: ${message}`,
      };
    }
  }
}
