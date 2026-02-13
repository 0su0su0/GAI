import type { AgentResponse, ToolCall, ToolResult } from './types.js';
import { LLMManager } from '../llm/LLMManager.js';
import { ToolRegistry } from './ToolRegistry.js';

export interface AgentConfig {
  maxIterations?: number;
  verbose?: boolean;
}

export class Agent {
  private maxIterations: number;
  private verbose: boolean;

  constructor(
    private llmManager: LLMManager,
    private toolRegistry: ToolRegistry,
    config: AgentConfig = {}
  ) {
    this.maxIterations = config.maxIterations || 10;
    this.verbose = config.verbose ?? false;
  }

  /**
   * Process a user request and execute the agentic loop
   */
  async processRequest(input: string): Promise<AgentResponse> {
    // Add user message to LLM history
    this.llmManager.addUserMessage(input);

    let iterations = 0;
    let lastResponse: AgentResponse = {
      message: '',
      finished: false,
    };

    while (iterations < this.maxIterations) {
      iterations++;

      if (this.verbose) {
        console.log(`\n[Iteration ${iterations}/${this.maxIterations}]`);
      }

      // Send to LLM with available tools
      const tools = this.toolRegistry.getDefinitions();
      const response = await this.llmManager.send(tools);

      if (this.verbose) {
        console.log(`LLM Response: ${response.content.substring(0, 100)}...`);
        console.log(`Stop Reason: ${response.stopReason}`);
        console.log(`Tool Calls: ${response.toolCalls?.length || 0}`);
      }

      // Check if we're done (no tool calls)
      if (!response.toolCalls || response.toolCalls.length === 0) {
        lastResponse = {
          message: response.content,
          finished: true,
        };
        break;
      }

      // Execute tool calls
      const toolResults = await this.executeToolCalls(response.toolCalls);

      // Add tool results to LLM history
      for (let i = 0; i < response.toolCalls.length; i++) {
        const toolCall = response.toolCalls[i];
        const result = toolResults[i];

        if (result.success) {
          if (!result.data) {
            throw new Error(`Tool ${toolCall.name} succeeded but returned no data`);
          }
          this.llmManager.addToolResult(toolCall.id, result.data);
        } else {
          if (!result.error) {
            throw new Error(`Tool ${toolCall.name} failed but returned no error message`);
          }
          this.llmManager.addToolResult(toolCall.id, result.error);
        }
      }

      lastResponse = {
        message: response.content,
        toolCalls: response.toolCalls,
        finished: false,
      };
    }

    if (iterations >= this.maxIterations) {
      lastResponse.message += '\n\n[Max iterations reached]';
      lastResponse.finished = true;
    }

    return lastResponse;
  }

  /**
   * Execute multiple tool calls in parallel
   */
  private async executeToolCalls(toolCalls: ToolCall[]): Promise<ToolResult[]> {
    if (this.verbose) {
      console.log(`\nExecuting ${toolCalls.length} tool calls...`);
    }

    const results = await Promise.all(
      toolCalls.map(async (toolCall) => {
        if (this.verbose) {
          console.log(`  - ${toolCall.name}(${JSON.stringify(toolCall.input).substring(0, 50)}...)`);
        }

        const result = await this.toolRegistry.execute(toolCall);

        if (this.verbose) {
          console.log(`    → ${result.success ? 'Success' : 'Failed'}`);
        }

        return result;
      })
    );

    return results;
  }

  /**
   * Stream a request (for real-time responses)
   */
  async *streamRequest(input: string): AsyncIterableIterator<string> {
    this.llmManager.addUserMessage(input);

    const tools = this.toolRegistry.getDefinitions();

    for await (const chunk of this.llmManager.stream(tools)) {
      if (chunk.type === 'content' && chunk.content) {
        yield chunk.content;
      } else if (chunk.type === 'tool_use' && chunk.toolCall) {
        yield `\n[Tool: ${chunk.toolCall.name}]`;
      }
    }
  }

  /**
   * Start a new session (clear history)
   */
  startSession(): void {
    this.llmManager.clearHistory();
  }

  /**
   * End a session (clear history)
   */
  endSession(): void {
    this.llmManager.clearHistory();
  }
}
