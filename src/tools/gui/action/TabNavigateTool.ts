/**
 * Tab Navigate Tool
 * Navigates through UI elements using Tab key
 */

import { ToolBase } from '../../ToolBase.js';
import { KeyboardController } from '../../../utils/automation/KeyboardController.js';
import type { ToolResult, ToolInput, TabNavigateInput } from '../../../core/types.js';

/**
 * Tool for Tab navigation
 */
export class TabNavigateTool extends ToolBase {
  readonly name = 'tab_navigate';
  readonly description =
    'Navigate through UI elements using Tab key. Can move forward or backward (Shift+Tab).';
  readonly inputSchema = {
    type: 'object',
    properties: {
      count: {
        type: 'number',
        description: 'Number of times to press Tab (default: 1)',
        default: 1,
      },
      reverse: {
        type: 'boolean',
        description: 'Navigate backwards using Shift+Tab (default: false)',
        default: false,
      },
    },
  };

  async execute(input: ToolInput): Promise<ToolResult> {
    const typedInput = input as TabNavigateInput;

    try {
      this.validateInput(input);

      const count = typedInput.count !== undefined ? typedInput.count : 1;
      const reverse = typedInput.reverse || false;

      if (count < 1) {
        return {
          success: false,
          error: 'count must be at least 1',
        };
      }

      // Press Tab multiple times
      for (let i = 0; i < count; i++) {
        KeyboardController.pressTab(reverse);

        // Small delay between Tab presses
        if (i < count - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      return {
        success: true,
        data: JSON.stringify({
          count,
          reverse,
          direction: reverse ? 'backward' : 'forward',
        }),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Tab navigation failed: ${message}`,
      };
    }
  }
}
