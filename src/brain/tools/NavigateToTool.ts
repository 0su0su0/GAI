/**
 * Navigate To Tool
 * Navigates to a target screen using the Navigation Brain
 */

import { ToolBase } from '../../tools/ToolBase.js';
import type { NavigationBrain } from '../NavigationBrain.js';
import type { ToolResult, ToolInput } from '../../core/types.js';

export interface NavigateToInput {
  target: string;
}

/**
 * Tool for navigating to a specific screen
 */
export class NavigateToTool extends ToolBase {
  readonly name = 'navigate_to';
  readonly description =
    'Navigate to a specific screen or state. Use natural language to describe the target (e.g., "Settings page", "Desktop folder in Finder", "Chrome preferences").';

  readonly inputSchema = {
    type: 'object',
    properties: {
      target: {
        type: 'string',
        description:
          'Natural language description of where to navigate (e.g., "Settings", "Desktop folder", "Terminal")',
      },
    },
    required: ['target'],
  };

  constructor(private brain: NavigationBrain) {
    super();
  }

  async execute(input: ToolInput): Promise<ToolResult> {
    const typedInput = input as NavigateToInput;

    try {
      this.validateInput(input);

      if (!typedInput.target) {
        return {
          success: false,
          error: 'target is required',
        };
      }

      console.log(`[NavigateToTool] Navigating to: ${typedInput.target}`);

      // Use brain to navigate
      const success = await this.brain.navigateTo(typedInput.target);

      if (!success) {
        return {
          success: false,
          error: `Failed to navigate to "${typedInput.target}". The brain could not learn or execute the path.`,
        };
      }

      // Get the new node
      const currentNode = this.brain.getCurrentNodeId();

      return {
        success: true,
        data: JSON.stringify({
          target: typedInput.target,
          currentNode: currentNode
            ? `${currentNode.programName}::${currentNode.stateHash}`
            : 'unknown',
          message: 'Successfully navigated to target',
        }),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Navigation failed: ${message}`,
      };
    }
  }
}
