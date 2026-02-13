import type { ToolDefinition, ToolCall, ToolResult } from './types.js';
import type { ToolBase } from '../tools/ToolBase.js';

export class ToolRegistry {
  private tools: Map<string, ToolBase> = new Map();

  /**
   * Register a tool
   */
  register(tool: ToolBase): void {
    if (this.tools.has(tool.name)) {
      console.warn(`Tool ${tool.name} is already registered. Overwriting.`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Get a tool by name
   */
  get(name: string): ToolBase | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools
   */
  getAll(): ToolBase[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tool definitions for LLM (tool calling)
   */
  getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((tool) => tool.getDefinition());
  }

  /**
   * Execute a tool call
   */
  async execute(toolCall: ToolCall): Promise<ToolResult> {
    const tool = this.tools.get(toolCall.name);

    if (!tool) {
      return {
        success: false,
        error: `Tool not found: ${toolCall.name}`,
      };
    }

    try {
      const result = await tool.execute(toolCall.input);
      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Tool execution failed: ${message}`,
      };
    }
  }

  /**
   * Check if a tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Unregister a tool
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Clear all tools
   */
  clear(): void {
    this.tools.clear();
  }

  /**
   * Get number of registered tools
   */
  count(): number {
    return this.tools.size;
  }
}
