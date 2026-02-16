# LLM 시스템

## 목차

1. [개요](#개요)
2. [LLMManager (181줄)](#llmmanager-181줄)
3. [BaseLLM (68줄)](#basellm-68줄)
4. [LLM 제공자](#llm-제공자)
5. [사용 예시](#사용-예시)

---

## 개요

LLM 시스템은 **멀티모드 LLM 관리**와 **4개 제공자 추상화**를 담당합니다.

### 구성 요소

| 컴포넌트 | 파일 | 라인 수 | 역할 |
|----------|------|---------|------|
| **LLMManager** | LLMManager.ts | 181 | 멀티모드 LLM 오케스트레이터 |
| **BaseLLM** | BaseLLM.ts | 68 | 추상 LLM 클래스 |
| **BaseLLMAdapter** | BaseLLMAdapter.ts | 57 | 레거시 어댑터 |
| **types** | types.ts | 63 | LLM 타입 정의 |
| **AnthropicLLM** | AnthropicLLM.ts | 283 | Claude 제공자 |
| **OpenAILLM** | OpenAILLM.ts | 288 | GPT 제공자 |
| **GoogleLLM** | GoogleLLM.ts | 246 | Gemini 제공자 |
| **OllamaLLM** | OllamaLLM.ts | 233 | Ollama 제공자 |

**총 9개 파일, 약 1,469줄**

### 핵심 설계

1. **Strategy Pattern**: 제공자별 구현을 추상화
2. **Factory Pattern**: `createLLM(config)` → `BaseLLM`
3. **Multi-mode System**: Default (stateful) + Fast/Vision (stateless)
4. **Fallback**: Fast/Vision이 없으면 Default 사용
5. **Provider-native History**: 각 제공자가 자체 히스토리 관리

---

## LLMManager (181줄)

**파일**: `src/llm/LLMManager.ts` (181줄)

### 목적

LLMManager는 **멀티모드 LLM 오케스트레이터**로, 3가지 모드(default/fast/vision)를 관리하고, 4개 제공자(Anthropic/OpenAI/Google/Ollama)를 추상화합니다.

### 클래스 구조

```typescript
export class LLMManager {
  private defaultLLM: BaseLLM;       // Default 모드 (필수, stateful)
  private fastLLM?: BaseLLM;         // Fast 모드 (선택, stateless)
  private visionLLM?: BaseLLM;       // Vision 모드 (선택, stateless)
  private config: LLMConfig;
  private isModeEnabled: boolean;    // 멀티모드 활성화 여부

  constructor(config: LLMConfig | LLMModeConfig)
}
```

### 설정 타입

#### 1. 단일 모드 설정

```typescript
interface LLMConfig {
  provider: 'anthropic' | 'openai' | 'google' | 'ollama';
  model: string;
  apiKey?: string;
  maxTokens?: number;
  temperature?: number;
  baseUrl?: string;  // Ollama용
}
```

**예시**:
```typescript
const config: LLMConfig = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-5-20250929',
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxTokens: 8096,
  temperature: 0.7
};

const llmManager = new LLMManager(config);
// → defaultLLM만 생성됨
```

#### 2. 멀티모드 설정 (권장)

```typescript
interface LLMModeConfig {
  default: LLMConfig;    // 필수
  fast?: LLMConfig;      // 선택 (없으면 default 사용)
  vision?: LLMConfig;    // 선택 (없으면 default 사용)
}
```

**예시**:
```typescript
const config: LLMModeConfig = {
  default: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-5-20250929',
    apiKey: process.env.ANTHROPIC_API_KEY
  },
  fast: {
    provider: 'anthropic',
    model: 'claude-haiku-4-5-20251001',
    apiKey: process.env.ANTHROPIC_API_KEY
  },
  vision: {
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    apiKey: process.env.ANTHROPIC_API_KEY
  }
};

const llmManager = new LLMManager(config);
// → defaultLLM, fastLLM, visionLLM 모두 생성됨
```

### Public API

#### 1. 히스토리 관리 (Default LLM만)

Default LLM은 **stateful**로, 내부 히스토리를 관리합니다.

##### addUserMessage(content: string | ContentBlock[]): void

```typescript
addUserMessage(content: string | ContentBlock[]): void {
  this.defaultLLM.addUserMessage(content);
}
```

**사용 예시**:
```typescript
llmManager.addUserMessage("계산기를 열어줘");
```

##### addAssistantMessage(content: string): void

```typescript
addAssistantMessage(content: string): void {
  this.defaultLLM.addAssistantMessage(content);
}
```

##### addToolResult(toolUseId: string, result: string): void

도구 실행 결과를 히스토리에 추가합니다.

```typescript
addToolResult(toolUseId: string, result: string): void {
  this.defaultLLM.addToolResult(toolUseId, result);
}
```

**사용 예시**:
```typescript
// Agent.ts에서
const response = await llmManager.send(tools);

if (response.toolCalls) {
  for (const toolCall of response.toolCalls) {
    const result = await toolRegistry.execute(toolCall);
    llmManager.addToolResult(toolCall.id, result.data);
  }
}
```

##### clearHistory(): void

히스토리를 초기화합니다.

```typescript
clearHistory(): void {
  this.defaultLLM.clearHistory();
}
```

#### 2. Default 모드 호출 (Stateful)

##### send(tools?: ToolDefinition[]): Promise<LLMResponse>

Default LLM을 호출합니다 (내부 히스토리 사용).

**시그니처**:
```typescript
async send(tools?: ToolDefinition[]): Promise<LLMResponse>
```

**내부 로직**:
```typescript
async send(tools?: ToolDefinition[]): Promise<LLMResponse> {
  try {
    return await this.defaultLLM.send(tools);
  } catch (error: unknown) {
    // Rate limit 재시도
    const message = error instanceof Error ? error.message : '';
    if (message.includes('rate limit')) {
      console.warn('Rate limited, waiting 1s and retrying...');
      await this.sleep(1000);
      return await this.defaultLLM.send(tools);
    }
    throw error;
  }
}
```

**특징**:
- **Stateful**: 내부 히스토리 사용
- **Rate Limit 재시도**: 1초 대기 후 재시도
- **Tool Calling 지원**: `tools` 파라미터로 도구 정의 전달

**사용 예시**:
```typescript
// Agent.ts에서
const tools = toolRegistry.getDefinitions();
const response = await llmManager.send(tools);

console.log(response.content);      // "I'll help you..."
console.log(response.toolCalls);    // [{ name: "click", input: {...} }]
console.log(response.stopReason);   // "tool_use" or "end_turn"
```

##### stream(tools?: ToolDefinition[]): AsyncIterableIterator<LLMStreamChunk>

스트리밍 응답을 위한 메서드입니다.

```typescript
async *stream(tools?: ToolDefinition[]): AsyncIterableIterator<LLMStreamChunk> {
  yield* this.defaultLLM.stream(tools);
}
```

**사용 예시**:
```typescript
for await (const chunk of llmManager.stream(tools)) {
  if (chunk.type === 'content' && chunk.content) {
    process.stdout.write(chunk.content);
  } else if (chunk.type === 'tool_use' && chunk.toolCall) {
    console.log(`\n[Tool: ${chunk.toolCall.name}]`);
  }
}
```

#### 3. Fast/Vision 모드 호출 (Stateless)

##### sendWithMode(mode, messages, tools?): Promise<LLMResponse>

특정 모드의 LLM을 호출합니다 (1회성, stateless).

**시그니처**:
```typescript
async sendWithMode(
  mode: 'default' | 'fast' | 'vision',
  messages: Message[],
  tools?: ToolDefinition[]
): Promise<LLMResponse>
```

**내부 로직**:
```typescript
async sendWithMode(
  mode: LLMMode,
  messages: Message[],
  tools?: ToolDefinition[]
): Promise<LLMResponse> {
  if (mode === 'default') {
    // default는 1회성으로도 사용 가능
    return await this.defaultLLM.sendOnce(messages, tools);
  }

  // Fast/Vision LLM 가져오기 (없으면 fallback)
  const llm = this.getLLMForMode(mode);

  try {
    return await llm.sendOnce(messages, tools);
  } catch (error: unknown) {
    // Rate limit 재시도
    const message = error instanceof Error ? error.message : '';
    if (message.includes('rate limit')) {
      console.warn('Rate limited, waiting 1s and retrying...');
      await this.sleep(1000);
      return await llm.sendOnce(messages, tools);
    }
    throw error;
  }
}
```

**Fallback 로직**:
```typescript
private getLLMForMode(mode: LLMMode): BaseLLM {
  if (mode === 'fast' && this.fastLLM) {
    return this.fastLLM;
  }
  if (mode === 'vision' && this.visionLLM) {
    return this.visionLLM;
  }
  // fallback: default LLM
  return this.defaultLLM;
}
```

**사용 예시**:

```typescript
// VLMAnalyzer.ts에서 Vision mode 사용
const messages: Message[] = [
  {
    role: 'user',
    content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: screenshot } },
      { type: 'text', text: 'What is the program name shown in this screenshot?' }
    ]
  }
];

const response = await llmManager.sendWithMode('vision', messages);
// → Vision LLM (Opus 4.6) 사용

const programName = response.content;
// → "Chrome"
```

```typescript
// SmartScreenReaderTool에서 Fast mode 사용
const messages: Message[] = [
  {
    role: 'user',
    content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: screenshot } },
      { type: 'text', text: 'Quickly describe this screen in 1-2 sentences.' }
    ]
  }
];

const response = await llmManager.sendWithMode('fast', messages);
// → Fast LLM (Haiku 4.5) 사용

console.log(response.content);
// → "This is a Chrome browser showing a Google search page."
```

#### 4. 기타 메서드

##### getAdapter(mode?: LLMMode): BaseLLM

특정 모드의 LLM 인스턴스를 반환합니다 (Dependency Injection용).

```typescript
getAdapter(mode: LLMMode = 'default'): BaseLLM {
  return this.getLLMForMode(mode);
}
```

**사용 예시**:
```typescript
// SmartScreenReaderTool.ts에서
const llm = this.llmManager.getAdapter('fast');
// 이 도구는 fast LLM을 주입받아 사용
```

##### isModeConfigEnabled(): boolean

멀티모드가 활성화되었는지 확인합니다.

```typescript
isModeConfigEnabled(): boolean {
  return this.isModeEnabled;
}
```

##### updateConfig(config: Partial<LLMConfig>): void

설정을 업데이트하고 Default LLM을 재생성합니다.

```typescript
updateConfig(config: Partial<LLMConfig>): void {
  this.config = { ...this.config, ...config };
  this.defaultLLM = this.createLLM(this.config);
}
```

### Private Methods

#### createLLM(config: LLMConfig): BaseLLM

**Factory Pattern**: 제공자에 따라 적절한 LLM 인스턴스를 생성합니다.

```typescript
private createLLM(config: LLMConfig): BaseLLM {
  const provider = config.provider;

  switch (provider) {
    case 'anthropic':
      return new AnthropicLLM(config);
    case 'openai':
      return new OpenAILLM(config);
    case 'google':
      return new GoogleLLM(config);
    case 'ollama':
      return new OllamaLLM(config);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
```

#### isModeConfig(config): boolean

설정이 멀티모드인지 확인합니다 (Type Guard).

```typescript
private isModeConfig(config: LLMConfig | LLMModeConfig): config is LLMModeConfig {
  return 'default' in config && 'fast' in config && 'vision' in config;
}
```

### 모드 시스템 요약

| 모드 | 상태 | 용도 | 히스토리 | 예시 모델 |
|------|------|------|----------|-----------|
| **Default** | Stateful | 에이전트 루프 | O (자동 관리) | Sonnet 4.5 |
| **Fast** | Stateless | 빠른 작업 | X (1회성) | Haiku 4.5 |
| **Vision** | Stateless | 화면 분석 | X (1회성) | Opus 4.6 |

**핵심 차이**:
- **Default**: `send()` 사용, 히스토리 자동 관리
- **Fast/Vision**: `sendWithMode()` 사용, 매번 `messages` 직접 전달

---

## BaseLLM (68줄)

**파일**: `src/llm/base/BaseLLM.ts` (68줄)

### 목적

BaseLLM은 **추상 LLM 클래스**로, 모든 제공자가 상속해야 하는 기본 인터페이스입니다.

### 클래스 구조

```typescript
export abstract class BaseLLM {
  protected history: Message[] = [];
  protected config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  // 추상 메서드 (각 제공자가 구현)
  abstract send(tools?: ToolDefinition[]): Promise<LLMResponse>;
  abstract stream(tools?: ToolDefinition[]): AsyncIterableIterator<LLMStreamChunk>;
  abstract sendOnce(messages: Message[], tools?: ToolDefinition[]): Promise<LLMResponse>;

  // 구체 메서드 (공통 로직)
  addUserMessage(content: string | ContentBlock[]): void { /* ... */ }
  addAssistantMessage(content: string): void { /* ... */ }
  addToolResult(toolUseId: string, result: string): void { /* ... */ }
  clearHistory(): void { /* ... */ }
  updateConfig(config: Partial<LLMConfig>): void { /* ... */ }
  getConfig(): LLMConfig { /* ... */ }
}
```

### 추상 메서드 (각 제공자가 구현)

#### 1. send(tools?): Promise<LLMResponse>

내부 히스토리를 사용하여 LLM을 호출합니다 (Stateful).

```typescript
abstract send(tools?: ToolDefinition[]): Promise<LLMResponse>;
```

**구현 예시** (AnthropicLLM):
```typescript
async send(tools?: ToolDefinition[]): Promise<LLMResponse> {
  // 1. 히스토리 검증
  if (this.history.length === 0) {
    throw new Error('No messages in history');
  }

  // 2. Anthropic API 호출
  const response = await this.client.messages.create({
    model: this.config.model,
    messages: this.convertToAnthropicFormat(this.history),
    tools: tools ? this.convertToolsToAnthropicFormat(tools) : undefined,
    max_tokens: this.config.maxTokens || 8096
  });

  // 3. 응답 변환
  return this.convertFromAnthropicFormat(response);
}
```

#### 2. stream(tools?): AsyncIterableIterator<LLMStreamChunk>

스트리밍 응답을 위한 메서드입니다.

```typescript
abstract stream(tools?: ToolDefinition[]): AsyncIterableIterator<LLMStreamChunk>;
```

#### 3. sendOnce(messages, tools?): Promise<LLMResponse>

1회성 호출 (Stateless, 히스토리 사용 안 함).

```typescript
abstract sendOnce(messages: Message[], tools?: ToolDefinition[]): Promise<LLMResponse>;
```

### 구체 메서드 (공통 로직)

#### addUserMessage(content: string | ContentBlock[]): void

```typescript
addUserMessage(content: string | ContentBlock[]): void {
  const contentBlocks: ContentBlock[] = typeof content === 'string'
    ? [{ type: 'text', text: content }]
    : content;

  this.history.push({
    role: 'user',
    content: contentBlocks
  });
}
```

#### addAssistantMessage(content: string): void

```typescript
addAssistantMessage(content: string): void {
  this.history.push({
    role: 'assistant',
    content: [{ type: 'text', text: content }]
  });
}
```

#### addToolResult(toolUseId: string, result: string): void

```typescript
addToolResult(toolUseId: string, result: string): void {
  // 1. 마지막 assistant 메시지에 tool_use가 있는지 확인
  const lastMessage = this.history[this.history.length - 1];
  if (!lastMessage || lastMessage.role !== 'assistant') {
    throw new Error('Cannot add tool result without prior tool_use');
  }

  // 2. tool_result를 user 메시지로 추가
  this.history.push({
    role: 'user',
    content: [
      {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: result
      }
    ]
  });
}
```

**히스토리 구조 예시**:
```typescript
[
  { role: 'user', content: [{ type: 'text', text: '계산기 열어줘' }] },
  {
    role: 'assistant',
    content: [
      { type: 'text', text: 'I will launch the calculator.' },
      { type: 'tool_use', id: 'call-123', name: 'launch_app', input: { appName: 'Calculator' } }
    ]
  },
  {
    role: 'user',
    content: [
      { type: 'tool_result', tool_use_id: 'call-123', content: 'Successfully launched: Calculator' }
    ]
  },
  {
    role: 'assistant',
    content: [{ type: 'text', text: 'Calculator가 실행되었습니다.' }]
  }
]
```

#### clearHistory(): void

```typescript
clearHistory(): void {
  this.history = [];
}
```

---

## LLM 제공자

### 1. AnthropicLLM (283줄)

**파일**: `src/llm/providers/AnthropicLLM.ts` (283줄)

**SDK**: `@anthropic-ai/sdk`

**특징**:
- ✅ 도구 호출 완전 지원
- ✅ 네이티브 메시지 포맷 사용
- ✅ 스트리밍 지원

**주요 메서드**:

#### send(tools?): Promise<LLMResponse>

```typescript
async send(tools?: ToolDefinition[]): Promise<LLMResponse> {
  if (this.history.length === 0) {
    throw new Error('[AnthropicLLM] No messages in history');
  }

  const response = await this.client.messages.create({
    model: this.config.model,
    messages: this.convertToAnthropicFormat(this.history),
    tools: tools ? this.convertToolsToAnthropicFormat(tools) : undefined,
    max_tokens: this.config.maxTokens || 8096,
    temperature: this.config.temperature
  });

  return this.convertFromAnthropicFormat(response);
}
```

**Message 포맷 변환**:

```typescript
// 우리 포맷 → Anthropic 포맷
private convertToAnthropicFormat(messages: Message[]): AnthropicMessage[] {
  return messages.map((msg) => ({
    role: msg.role,
    content: msg.content.map((block) => {
      if (block.type === 'text') {
        return { type: 'text', text: block.text };
      } else if (block.type === 'image') {
        return {
          type: 'image',
          source: {
            type: block.source.type,
            media_type: block.source.media_type,
            data: block.source.data
          }
        };
      } else if (block.type === 'tool_use') {
        return {
          type: 'tool_use',
          id: block.id,
          name: block.name,
          input: block.input
        };
      } else if (block.type === 'tool_result') {
        return {
          type: 'tool_result',
          tool_use_id: block.tool_use_id,
          content: block.content
        };
      }
    })
  }));
}

// Anthropic 포맷 → 우리 포맷
private convertFromAnthropicFormat(response: AnthropicResponse): LLMResponse {
  const content: ContentBlock[] = response.content.map((block) => {
    if (block.type === 'text') {
      return { type: 'text', text: block.text };
    } else if (block.type === 'tool_use') {
      return {
        type: 'tool_use',
        id: block.id,
        name: block.name,
        input: block.input
      };
    }
  });

  return {
    content: content.find((b) => b.type === 'text')?.text || '',
    toolCalls: content.filter((b) => b.type === 'tool_use').map((b) => ({
      id: b.id,
      name: b.name,
      input: b.input
    })),
    stopReason: response.stop_reason
  };
}
```

### 2. OpenAILLM (288줄)

**파일**: `src/llm/providers/OpenAILLM.ts` (288줄)

**SDK**: `openai`

**특징**:
- ✅ 도구 호출 완전 지원 (`function_call`)
- ✅ 스트리밍 지원
- ⚠️ 메시지 포맷 변환 필요 (OpenAI 포맷 ≠ 우리 포맷)

**주요 차이점**:
- **Role**: `user` | `assistant` | `system`
- **Tool Calling**: `functions` 또는 `tools` 파라미터
- **Image**: `content` 내부에 `image_url` 객체

### 3. GoogleLLM (246줄)

**파일**: `src/llm/providers/GoogleLLM.ts` (246줄)

**SDK**: `@google/generative-ai`

**특징**:
- ❌ 도구 호출 미지원 (텍스트만)
- ✅ Vision 지원
- ⚠️ Role 제한: `user` | `model` (assistant → model로 변환)

**제한사항**:
```typescript
async send(tools?: ToolDefinition[]): Promise<LLMResponse> {
  if (tools && tools.length > 0) {
    console.warn('[GoogleLLM] Tool calling not supported. Ignoring tools.');
  }

  // 텍스트 응답만 가능
  const result = await this.model.generateContent({
    contents: this.convertToGoogleFormat(this.history)
  });

  return {
    content: result.response.text(),
    toolCalls: undefined,  // 도구 호출 불가
    stopReason: 'end_turn'
  };
}
```

### 4. OllamaLLM (233줄)

**파일**: `src/llm/providers/OllamaLLM.ts` (233줄)

**SDK**: 없음 (HTTP API 직접 호출)

**특징**:
- ❌ 도구 호출 미지원 (텍스트만)
- ✅ 로컬 모델 지원
- ⚠️ `baseUrl` 설정 필요 (기본값: `http://localhost:11434`)

**API 호출**:
```typescript
async send(tools?: ToolDefinition[]): Promise<LLMResponse> {
  if (tools && tools.length > 0) {
    console.warn('[OllamaLLM] Tool calling not supported. Ignoring tools.');
  }

  const response = await fetch(`${this.baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: this.config.model,
      messages: this.convertToOllamaFormat(this.history),
      stream: false
    })
  });

  const data = await response.json();

  return {
    content: data.message.content,
    toolCalls: undefined,
    stopReason: 'end_turn'
  };
}
```

### 제공자 비교

| 제공자 | 도구 호출 | Vision | 스트리밍 | 특이사항 |
|--------|-----------|--------|----------|----------|
| **Anthropic** | ✅ | ✅ | ✅ | 네이티브 포맷 |
| **OpenAI** | ✅ | ✅ | ✅ | `function_call` |
| **Google** | ❌ | ✅ | ✅ | role: `model` |
| **Ollama** | ❌ | ✅ | ✅ | HTTP API, `baseUrl` 필요 |

---

## 사용 예시

### 기본 사용 (단일 모드)

```typescript
import { LLMManager } from './llm/LLMManager';

const config = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-5-20250929',
  apiKey: process.env.ANTHROPIC_API_KEY
};

const llmManager = new LLMManager(config);

// 사용자 메시지 추가
llmManager.addUserMessage("계산기를 열어줘");

// LLM 호출
const response = await llmManager.send(tools);
console.log(response.content);
console.log(response.toolCalls);
```

### 멀티모드 사용

```typescript
const config = {
  default: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-5-20250929',
    apiKey: process.env.ANTHROPIC_API_KEY
  },
  fast: {
    provider: 'anthropic',
    model: 'claude-haiku-4-5-20251001',
    apiKey: process.env.ANTHROPIC_API_KEY
  },
  vision: {
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    apiKey: process.env.ANTHROPIC_API_KEY
  }
};

const llmManager = new LLMManager(config);

// Default mode (stateful)
llmManager.addUserMessage("화면을 분석해줘");
const response1 = await llmManager.send();

// Vision mode (stateless)
const messages = [
  {
    role: 'user',
    content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: screenshot } },
      { type: 'text', text: 'What is in this image?' }
    ]
  }
];
const response2 = await llmManager.sendWithMode('vision', messages);

// Fast mode (stateless)
const messages2 = [
  { role: 'user', content: [{ type: 'text', text: 'Summarize this in 1 sentence.' }] }
];
const response3 = await llmManager.sendWithMode('fast', messages2);
```

### 스트리밍 사용

```typescript
for await (const chunk of llmManager.stream(tools)) {
  if (chunk.type === 'content') {
    process.stdout.write(chunk.content);
  } else if (chunk.type === 'tool_use') {
    console.log(`\n[Tool: ${chunk.toolCall.name}]`);
  }
}
```

---

## 요약

### LLMManager
- **역할**: 멀티모드 LLM 오케스트레이터
- **모드**: Default (stateful) + Fast/Vision (stateless)
- **Fallback**: Fast/Vision이 없으면 Default 사용
- **Factory**: `createLLM()` → 4개 제공자 생성
- **Rate Limit**: 자동 재시도 (1초 대기)

### BaseLLM
- **역할**: 추상 LLM 클래스
- **히스토리 관리**: `addUserMessage`, `addToolResult`, `clearHistory`
- **추상 메서드**: `send`, `stream`, `sendOnce`

### 제공자
- **Anthropic**: 도구 호출 ✅, Vision ✅
- **OpenAI**: 도구 호출 ✅, Vision ✅
- **Google**: 도구 호출 ❌, Vision ✅
- **Ollama**: 도구 호출 ❌, Vision ✅, 로컬 모델

### 핵심 통찰
1. **Stateful vs Stateless**: Default는 상태 유지, Fast/Vision은 1회성
2. **Provider 추상화**: Strategy Pattern으로 제공자 독립성
3. **멀티모드 최적화**: 작업에 따라 적절한 LLM 선택
4. **Fallback 시스템**: 설정 없으면 자동으로 Default 사용

LLM 시스템은 GAI의 **두뇌**로, 모든 의사결정과 도구 호출을 담당합니다.

---

다음 문서: [05-도구시스템.md](05-도구시스템.md)
