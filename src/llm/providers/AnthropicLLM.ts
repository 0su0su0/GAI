import Anthropic from "@anthropic-ai/sdk";
import { BaseLLM } from "../base/BaseLLM.js";
import type {
  Message,
  ToolDefinition,
  LLMResponse,
  LLMStreamChunk,
  LLMConfig,
  ToolCall,
  ContentBlock,
} from "../../core/types.js";

interface AnthropicContentBlock {
  type: "text" | "image";
  text?: string;
  source?: {
    type: string;
    media_type: string;
    data: string;
  };
}

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
}

interface AnthropicTool {
  name: string;
  description: string;
  input_schema: object;
}

export class AnthropicLLM extends BaseLLM {
  private client: Anthropic;
  private history: AnthropicMessage[] = [];

  constructor(config: LLMConfig) {
    super(config);
    if (!config.apiKey) {
      throw new Error("Anthropic API key required");
    }
    if (!config.model) {
      throw new Error("Anthropic model required");
    }
    if (config.maxTokens === undefined) {
      throw new Error("maxTokens required");
    }
    if (config.temperature === undefined) {
      throw new Error("temperature required");
    }
    this.client = new Anthropic({ apiKey: config.apiKey });
  }

  // ===== 히스토리 관리 =====

  addUserMessage(content: string | ContentBlock[]): void {
    this.history.push({
      role: "user",
      content: this.convertContent(content),
    });
  }

  addAssistantMessage(content: string): void {
    this.history.push({
      role: "assistant",
      content,
    });
  }

  addToolResult(toolUseId: string, result: string): void {
    this.history.push({
      role: "user",
      content: [
        {
          type: "text",
          text: JSON.stringify({
            tool_use_id: toolUseId,
            type: "tool_result",
            content: result,
          }),
        },
      ],
    });
  }

  clearHistory(): void {
    this.history = [];
  }

  // ===== 내부 유틸리티 =====

  private convertContent(
    content: string | ContentBlock[],
  ): string | AnthropicContentBlock[] {
    if (typeof content === "string") {
      return content;
    }

    return content.map((block) => {
      if (block.type === "text") {
        return { type: "text" as const, text: block.text };
      } else {
        if (!block.source.media_type) {
          throw new Error("Image media_type required");
        }
        return {
          type: "image" as const,
          source: {
            type: block.source.type,
            media_type: block.source.media_type,
            data: block.source.data,
          },
        };
      }
    });
  }

  private convertMessages(messages: Message[]): AnthropicMessage[] {
    return messages.map((msg) => ({
      role:
        msg.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content:
        typeof msg.content === "string"
          ? msg.content
          : this.convertContent(msg.content),
    }));
  }

  private convertTools(tools?: ToolDefinition[]): AnthropicTool[] | undefined {
    return tools?.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.input_schema,
    }));
  }

  // ===== 내부 히스토리 사용 (default 모드) =====

  async send(tools?: ToolDefinition[]): Promise<LLMResponse> {
    const modelId = this.config.model;
    if (!modelId) {
      throw new Error("Model ID required");
    }

    const response = await this.client.messages.create({
      model: modelId,
      max_tokens: this.config.maxTokens!,
      temperature: this.config.temperature!,
      messages: this.history as Anthropic.MessageParam[],
      tools: this.convertTools(tools) as Anthropic.Tool[] | undefined,
    });

    // Extract text content
    let textContent = "";
    const toolCalls: ToolCall[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        textContent += block.text;
      } else if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: block.input,
        });
      }
    }

    // 응답을 히스토리에 자동 추가
    if (textContent || toolCalls.length > 0) {
      this.addAssistantMessage(textContent);
    }

    return {
      content: textContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      stopReason:
        response.stop_reason === "end_turn"
          ? "end_turn"
          : response.stop_reason === "tool_use"
            ? "tool_use"
            : "max_tokens",
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }

  async *stream(
    tools?: ToolDefinition[],
  ): AsyncIterableIterator<LLMStreamChunk> {
    const modelId = this.config.model;
    if (!modelId) {
      throw new Error("Model ID required");
    }

    const stream = await this.client.messages.create({
      model: modelId,
      max_tokens: this.config.maxTokens!,
      temperature: this.config.temperature!,
      messages: this.history as Anthropic.MessageParam[],
      tools: this.convertTools(tools) as Anthropic.Tool[] | undefined,
      stream: true,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") {
          yield { type: "content", content: event.delta.text };
        }
      } else if (
        event.type === "content_block_start" &&
        event.content_block.type === "tool_use"
      ) {
        yield {
          type: "tool_use",
          toolCall: {
            id: event.content_block.id,
            name: event.content_block.name,
            input: {},
          },
        };
      } else if (event.type === "message_stop") {
        yield { type: "done" };
      }
    }
  }

  // ===== 1회성 호출 (fast/vision 모드) =====

  async sendOnce(
    messages: Message[],
    tools?: ToolDefinition[],
  ): Promise<LLMResponse> {
    const modelId = this.config.model;
    if (!modelId) {
      throw new Error("Model ID required");
    }

    const anthropicMessages = this.convertMessages(messages);

    const response = await this.client.messages.create({
      model: modelId,
      max_tokens: this.config.maxTokens!,
      temperature: this.config.temperature!,
      messages: anthropicMessages as Anthropic.MessageParam[],
      tools: this.convertTools(tools) as Anthropic.Tool[] | undefined,
    });

    // Extract text content
    let textContent = "";
    const toolCalls: ToolCall[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        textContent += block.text;
      } else if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: block.input,
        });
      }
    }

    return {
      content: textContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      stopReason:
        response.stop_reason === "end_turn"
          ? "end_turn"
          : response.stop_reason === "tool_use"
            ? "tool_use"
            : "max_tokens",
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }
}
