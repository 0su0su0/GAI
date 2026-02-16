/**
 * Spotlight Tool
 * Opens macOS Spotlight and executes searches
 */

import { ToolBase } from '../../ToolBase.js';
import { KeyboardController } from '../../../utils/automation/KeyboardController.js';
import { isMacOS } from '../../../utils/platform.js';
import type { ToolResult, ToolInput, SpotlightInput } from '../../../core/types.js';

/**
 * Tool for macOS Spotlight
 */
export class SpotlightTool extends ToolBase {
  readonly name = 'spotlight';
  readonly description =
    'Open macOS Spotlight and search for applications or files. macOS only.';
  readonly inputSchema = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query for Spotlight',
      },
      pressEnter: {
        type: 'boolean',
        description: 'Press Enter to open the first result (default: true)',
        default: true,
      },
    },
    required: ['query'],
  };

  async execute(input: ToolInput): Promise<ToolResult> {
    const typedInput = input as SpotlightInput;

    try {
      this.validateInput(input);

      // Check if running on macOS
      if (!isMacOS()) {
        return {
          success: false,
          error: 'Spotlight is only available on macOS',
        };
      }

      if (!typedInput.query) {
        return {
          success: false,
          error: 'query is required',
        };
      }

      const pressEnter = typedInput.pressEnter !== undefined ? typedInput.pressEnter : true;

      // Open Spotlight (Cmd+Space)
      await KeyboardController.pressKey("space", ["command"]);

      // Wait for Spotlight to open
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Type the query
      KeyboardController.typeText(typedInput.query, 50);

      // Wait for search results
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Press Enter if requested
      if (pressEnter) {
        KeyboardController.pressEnter();
      }

      return {
        success: true,
        data: JSON.stringify({
          query: typedInput.query,
          pressEnter,
          platform: 'macos',
        }),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Spotlight search failed: ${message}`,
      };
    }
  }
}
