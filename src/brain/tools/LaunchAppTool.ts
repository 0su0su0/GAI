/**
 * Launch App Tool
 * Launches applications via Spotlight (the default system node)
 */

import { ToolBase } from '../../tools/ToolBase.js';
import { KeyboardController } from '../../utils/automation/KeyboardController.js';
import type { ToolResult, ToolInput } from '../../core/types.js';

export interface LaunchAppInput {
  appName: string;
}

/**
 * Tool for launching applications via Spotlight
 */
export class LaunchAppTool extends ToolBase {
  readonly name = 'launch_app';
  readonly description =
    'Launch an application via Spotlight. Spotlight is a system-level node accessible via Cmd+Space. Use this to open apps like "Calculator", "Terminal", "Chrome", etc.';

  readonly inputSchema = {
    type: 'object',
    properties: {
      appName: {
        type: 'string',
        description: 'Name of the application to launch (e.g., "Calculator", "Terminal", "Chrome")',
      },
    },
    required: ['appName'],
  };

  constructor() {
    super();
  }

  async execute(input: ToolInput): Promise<ToolResult> {
    const typedInput = input as LaunchAppInput;

    try {
      this.validateInput(input);

      if (!typedInput.appName) {
        return {
          success: false,
          error: 'appName is required',
        };
      }

      console.log(`[LaunchAppTool] Launching ${typedInput.appName} via Spotlight...`);

      // Open Spotlight (Cmd+Space)
      await KeyboardController.pressKey("space", ["command"]);
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Type app name
      KeyboardController.typeText(typedInput.appName, 50);

      // Wait for search results
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Press Enter to launch
      KeyboardController.pressEnter();

      // Wait for app to launch
      await new Promise((resolve) => setTimeout(resolve, 2000));

      console.log(`[LaunchAppTool] Successfully launched ${typedInput.appName}`);

      return {
        success: true,
        data: JSON.stringify({
          appName: typedInput.appName,
          method: 'spotlight',
          message: `Successfully launched ${typedInput.appName} via Spotlight`,
        }),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to launch app: ${message}`,
      };
    }
  }
}
