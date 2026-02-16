import { GoogleGenerativeAI } from "@google/generative-ai";
import { BaseLLM } from "../base/BaseLLM.js";
import type {
  Message,
  ToolDefinition,
  LLMResponse,
  LLMStreamChunk,
  LLMConfig,
  ContentBlock,
} from "../../core/types.js";

interface GooglePart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

interface GoogleMessage {
  role: "user" | "model";
  parts: GooglePart[];
}

export class GoogleLLM extends BaseLLM {
  private genAI: GoogleGenerativeAI;
  private history: GoogleMessage[] = [];

  constructor(config: LLMConfig) {
    super(config);
    if (!config.apiKey) {
      throw new Error("Google API key required");
    }
    if (!config.model) {
      throw new Error("Google model required");
    }
    if (config.maxTokens === undefined) {
      throw new Error("maxTokens required");
    }
    if (config.temperature === undefined) {
      throw new Error("temperature required");
    }
    this.genAI = new GoogleGenerativeAI(config.apiKey);
  }

  // ===== 히스토리 관리 =====

  addUserMessage(content: string | ContentBlock[]): void {
    this.history.push({
      role: "user",
      parts: this.convertToParts(content),
    });
  }

  addAssistantMessage(content: string): void {
    this.history.push({
      role: "model",
      parts: [{ text: content }],
    });
  }

  addToolResult(toolUseId: string, result: string): void {
    this.history.push({
      role: "user",
      parts: [
        {
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

  private convertToParts(content: string | ContentBlock[]): GooglePart[] {
    if (typeof content === "string") {
      return [{ text: content }];
    }

    return content.map((block) => {
      if (block.type === "text") {
        return { text: block.text };
      } else {
        if (!block.source.media_type) {
          throw new Error("Image media_type required");
        }
        return {
          inlineData: {
            mimeType: block.source.media_type,
            data: block.source.data,
          },
        };
      }
    });
  }

  private convertMessages(messages: Message[]): GoogleMessage[] {
    return messages.map((msg) => ({
      role: msg.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: this.convertToParts(msg.content),
    }));
  }

  // ===== 내부 히스토리 사용 (default 모드) =====

  async send(_tools?: ToolDefinition[]): Promise<LLMResponse> {
    const modelId = this.config.model;
    if (!modelId) {
      throw new Error("Model ID required");
    }

    const model = this.genAI.getGenerativeModel({
      model: modelId,
      generationConfig: {
        maxOutputTokens: this.config.maxTokens!,
        temperature: this.config.temperature!,
      },
    });

    // 마지막 메시지를 프롬프트로 사용
    const lastMessage = this.history[this.history.length - 1];
    const prompt = lastMessage.parts
      .map((p) => {
        if (!p.text) {
          throw new Error("Text part missing in message");
        }
        return p.text;
      })
      .join("");
    const historyWithoutLast = this.history.slice(0, -1);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chat = model.startChat({ history: historyWithoutLast as any });
    const result = await chat.sendMessage(prompt);
    const response = result.response;
    const content = response.text();

    // 응답을 히스토리에 자동 추가
    this.addAssistantMessage(content);

    return {
      content,
      stopReason: "end_turn",
      usage: {
        inputTokens: 0,
        outputTokens: 0,
      },
    };
  }

  async *stream(
    _tools?: ToolDefinition[],
  ): AsyncIterableIterator<LLMStreamChunk> {
    const modelId = this.config.model;
    if (!modelId) {
      throw new Error("Model ID required");
    }

    const model = this.genAI.getGenerativeModel({
      model: modelId,
      generationConfig: {
        maxOutputTokens: this.config.maxTokens!,
        temperature: this.config.temperature!,
      },
    });

    const lastMessage = this.history[this.history.length - 1];
    const prompt = lastMessage.parts
      .map((p) => {
        if (!p.text) {
          throw new Error("Text part missing in message");
        }
        return p.text;
      })
      .join("");
    const historyWithoutLast = this.history.slice(0, -1);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chat = model.startChat({ history: historyWithoutLast as any });
    const result = await chat.sendMessageStream(prompt);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        yield { type: "content", content: text };
      }
    }

    yield { type: "done" };
  }

  // ===== 1회성 호출 (fast/vision 모드) =====

  async sendOnce(
    messages: Message[],
    _tools?: ToolDefinition[],
  ): Promise<LLMResponse> {
    const modelId = this.config.model;
    if (!modelId) {
      throw new Error("Model ID required");
    }

    const model = this.genAI.getGenerativeModel({
      model: modelId,
      generationConfig: {
        maxOutputTokens: this.config.maxTokens!,
        temperature: this.config.temperature!,
      },
    });

    const history = this.convertMessages(messages.slice(0, -1));
    const lastMessage = messages[messages.length - 1];
    let prompt: string;
    if (typeof lastMessage.content === "string") {
      prompt = lastMessage.content;
    } else {
      const textBlock = lastMessage.content.find((b) => b.type === "text");
      if (!textBlock || !textBlock.text) {
        throw new Error("Text content required in last message");
      }
      prompt = textBlock.text;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chat = model.startChat({ history: history as any });
    const result = await chat.sendMessage(prompt);
    const response = result.response;

    return {
      content: response.text(),
      stopReason: "end_turn",
      usage: {
        inputTokens: 0,
        outputTokens: 0,
      },
    };
  }
}
