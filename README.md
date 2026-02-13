# GAI (Graphic Agent Interface)

MCP가 지원되지 않는 서비스도 에이전트가 이용 가능하도록 에이전트와 GUI 간의 연동을 추가합니다.

## Features

- 🤖 **Agentic AI**: 자율 에이전트 기능
- 🔌 **Multi-LLM Support**: Anthropic (Claude), OpenAI, Google Gemini, Ollama 지원
- 🎚️ **Smart Mode Selection**: 작업에 따른 LLM 자동 선택 (기본 / 빠른 / 비전)
- 🛠️ **Tool Calling**: LLM native tool calling으로 GUI 자동화
- 💉 **Dependency Injection**: GUI 툴이 LLM을 주입받아 Vision API 활용
- 🎯 **Modular**: 텔레그램 모듈 선택적 빌드 가능
- ⚙️ **ENV-based Config**: 환경변수 우선 설정 시스템

## Quick Start

### 1. Installation

```bash
npm install
```

### 2. Configuration

환경변수로 설정:

```bash
# .env 파일 생성
cp config/.env.example config/.env

# .env 파일 편집
nano config/.env
```

```.env
# API Keys
ANTHROPIC_API_KEY=sk-ant-xxx
OPENAI_API_KEY=sk-xxx
GOOGLE_API_KEY=xxx
OLLAMA_BASE_URL=http://localhost:11434

# LLM (DEFAULT 필수, FAST/VISION 선택)
DEFAULT_PROVIDER=ollama
DEFAULT_MODEL=gpt-oss:120b
DEFAULT_MAX_TOKENS=8096
DEFAULT_TEMPERATURE=0.7

FAST_PROVIDER=ollama
FAST_MODEL=gpt-oss:20b
FAST_MAX_TOKENS=4096
FAST_TEMPERATURE=0.5

VISION_PROVIDER=ollama
VISION_MODEL=qwen2.5vl:32b
VISION_MAX_TOKENS=8096
VISION_TEMPERATURE=0.7

# Agent
AGENT_MAX_ITERATIONS=10

# Telegram
TELEGRAM_ENABLED=false
TELEGRAM_BOT_TOKEN=xxx
```

### 3. Run

```bash
# 개발 모드 (대화형)
npm run dev

# 프로덕션 빌드 후 실행
npm run build
npm start
```

## Architecture

```
CLI / Telegram Bot
    ↓
Agent (추론 루프)
    ↓
LLM Manager
    ├─ Mode Selection (default/fast/vision)
    └─ Providers (Anthropic | OpenAI | Google | Ollama)
        └─ Provider-native History Management
    ↓
Tool Registry → GUI Tools | Built-in Tools
```

**핵심 설계:**
- **DI Pattern**: GUI 툴이 LLM 인스턴스 주입받아 사용
- **Provider-native History**: 각 LLM이 자체 히스토리 관리
- **ENV-first Config**: 환경변수가 최우선, fallback 지원
- **Plugin System**: 새로운 툴을 쉽게 추가 가능

## Current Status

✅ **Implemented**:
- Core type definitions
- **LLM provider system (ALL)**:
  - ✅ Anthropic (Claude)
  - ✅ OpenAI (GPT)
  - ✅ Google (Gemini)
  - ✅ Ollama (Local models)
- Provider-native history management
- Tool system with DI
- Agent core (agentic loop)
- ENV-based configuration system
- CLI interface
- Mode selection (default/fast/vision)

🚧 **TODO**:
- GUI 툴 실제 구현 (화면 캡처, 클릭, 입력)
- 텔레그램 모듈
- 벡터 DB 연동

## LLM Mode System

작업에 따라 적절한 LLM을 선택하여 비용과 성능을 최적화:

### 🎯 Default Mode (기본 모델)
- **용도**: 복잡한 추론, 코드 생성, 깊은 분석
- **예시 모델**: Claude Opus, GPT-4, Gemini Pro
- **사용 케이스**: 아키텍처 설계, 버그 분석, 복잡한 로직 구현

### ⚡ Fast Mode (빠른 모델)
- **용도**: 빠른 응답, 단순 작업, 비용 절감
- **예시 모델**: Claude Haiku, GPT-3.5, Llama 3 (local)
- **사용 케이스**: 텍스트 요약, 간단한 질문 응답, 데이터 추출

### 👁️ Vision Mode (비전 모델)
- **용도**: 화면 캡처 분석, UI 요소 인식
- **예시 모델**: Claude Sonnet (Vision), GPT-4 Vision, Gemini Vision
- **사용 케이스**: 화면 이해, GUI 자동화, 이미지 기반 작업

## Configuration

### ENV 우선순위

1. **환경변수** (.env 파일 또는 시스템 환경변수) - 최우선
2. **JSON 설정 파일** (config/config.json) - fallback
3. **기본값** (코드 내부) - 마지막 fallback

### Fallback 시스템

FAST/VISION 모드가 설정되지 않으면 DEFAULT 사용:

```env
# DEFAULT만 설정 → 모든 모드에서 DEFAULT 사용
DEFAULT_PROVIDER=ollama
DEFAULT_MODEL=gpt-oss:120b
DEFAULT_MAX_TOKENS=8096
DEFAULT_TEMPERATURE=0.7

# FAST 추가 설정 → FAST는 20b 사용, VISION은 DEFAULT 사용
FAST_PROVIDER=ollama
FAST_MODEL=gpt-oss:20b
FAST_MAX_TOKENS=4096
FAST_TEMPERATURE=0.5
```

### 지원 모델

#### Anthropic (2026-02 최신)
- claude-opus-4 (가장 강력, multimodal)
- claude-sonnet-4.5 (균형잡힌 성능, multimodal)
- claude-haiku-4.5 (빠르고 저렴, multimodal)

#### OpenAI (2026-02 최신)
- gpt-5.2 (가장 강력)
- gpt-4.1 (고성능)
- o4-mini (추론 특화)

#### Google (2026-02 최신)
- gemini-3-pro-preview (가장 강력, multimodal, 1M tokens)
- gemini-3-flash-preview (빠르고 강력, multimodal, 1M tokens)
- gemini-2.5-pro (안정 버전, multimodal)

#### Ollama (로컬)
- 모든 Ollama 지원 모델 사용 가능

## Example Usage

```bash
# 대화형 모드로 실행
npm start

# 실행 후 프롬프트에서 메시지 입력
> Echo hello world
> Analyze the current screen
```

## Development

```bash
# 개발 모드 (tsx로 즉시 실행)
npm run dev

# 빌드
npm run build

# 빌드된 파일 실행
npm start
```

## License

MIT License
