import type { ToolDefinition, ToolResult, ToolInput } from '../core/types.js';
import type { BaseLLM } from '../llm/base/BaseLLM.js';

export abstract class ToolBase {
  protected llm?: BaseLLM;

  constructor(llm?: BaseLLM) {
    this.llm = llm;
  }

  // Abstract properties that each tool must define
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly inputSchema: object;

  // Abstract method that each tool must implement
  abstract execute(input: ToolInput): Promise<ToolResult>;

  /**
   * Get tool definition for LLM
   */
  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      input_schema: this.inputSchema,
    };
  }

  /**
   * Validate input against schema (basic validation)
   */
  protected validateInput(input: ToolInput): void {
    if (!input || typeof input !== 'object') {
      throw new Error(`Invalid input for tool ${this.name}: expected object`);
    }

    const schema = this.inputSchema as { required?: string[] };
    const requiredFields = schema.required;
    if (requiredFields) {
      for (const field of requiredFields) {
        if (!(field in input)) {
          throw new Error(`Missing required field '${field}' for tool ${this.name}`);
        }
      }
    }
  }

  /**
   * Check if LLM is available for this tool
   */
  protected hasLLM(): boolean {
    return this.llm !== undefined;
  }
}
