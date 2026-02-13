import { ToolBase } from '../ToolBase.js';
import type { ToolResult, ToolInput } from '../../core/types.js';

/**
 * Simple echo tool for testing
 */
export class EchoTool extends ToolBase {
  readonly name = 'echo';
  readonly description = 'Echoes back the input message. Useful for testing.';
  readonly inputSchema = {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'The message to echo back',
      },
    },
    required: ['message'],
  };

  async execute(input: ToolInput): Promise<ToolResult> {
    const typedInput = input as { message: string };
    try {
      this.validateInput(input);

      return {
        success: true,
        data: JSON.stringify({
          echo: typedInput.message,
          timestamp: new Date().toISOString(),
        }),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: message,
      };
    }
  }
}
