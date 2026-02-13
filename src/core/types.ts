// ===== Message Types =====

export type MessageRole = 'user' | 'assistant' | 'tool';

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  source: {
    type: 'base64' | 'url';
    data: string;
    media_type?: string;
  };
}

export type ContentBlock = TextContent | ImageContent;

export interface Message {
  role: MessageRole;
  content: string | ContentBlock[];
}

// ===== Tool Types =====

export interface ScreenReaderInput {
  analyze?: boolean;
}

export interface EchoInput {
  message: string;
}

export interface SmartScreenReaderInput {
  mode?: 'quick' | 'detailed';
}

export type ToolInput = ScreenReaderInput | EchoInput | SmartScreenReaderInput;

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: object;
}

export interface ToolCall {
  id: string;
  name: string;
  input: ToolInput;
}

export interface ToolResult {
  success: boolean;
  data?: string;
  error?: string;
}

// ===== LLM Response Types =====

export type StopReason = 'end_turn' | 'max_tokens' | 'tool_use' | 'stop_sequence';

export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  stopReason: StopReason;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface LLMStreamChunk {
  type: 'content' | 'tool_use' | 'done';
  content?: string;
  toolCall?: ToolCall;
}

// ===== Agent Types =====

export interface AgentResponse {
  message: string;
  toolCalls?: ToolCall[];
  reasoning?: string;
  finished: boolean;
}

// ===== Configuration Types =====

export type LLMProvider = 'anthropic' | 'openai' | 'google' | 'ollama';

export interface LLMConfig {
  provider: LLMProvider;
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  baseUrl?: string; // for Ollama
}

export interface TelegramConfig {
  enabled: boolean;
  botToken?: string;
}

export interface ToolsConfig {
  gui: {
    enabled: boolean;
    screenCaptureInterval?: number;
  };
  builtin: {
    filesystem?: boolean;
    websearch?: boolean;
    codeExecutor?: boolean;
  };
}

export interface AgentConfig {
  maxIterations: number;
}

// ===== LLM Mode Types =====

export type LLMMode = 'default' | 'fast' | 'vision';

export interface LLMModeConfig {
  default: LLMConfig;  // 기본 모델 (대부분의 작업)
  fast: LLMConfig;     // 빠른 모델 (간단한 작업, 비용 절감)
  vision: LLMConfig;   // 비전 모델 (이미지 분석 필요 시)
}

export interface Config {
  llm: LLMConfig | LLMModeConfig;  // 단일 또는 모드별 설정
  telegram: TelegramConfig;
  tools: ToolsConfig;
  agent: AgentConfig;
}
