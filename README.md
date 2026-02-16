# GAI (Graphic Agent Interface)

**비전 LLM과 OCR 기반의 지능형 GUI 자동화 에이전트 시스템**

> ⚠️ **개발 중 / Work in Progress**
> 이 프로젝트는 현재 **활발히 개발 중**이며 **미완성 상태**입니다.
> **코드 자체도 미완성**이며, 핵심 기능은 구현되었으나 테스트, Windows 지원, 일부 도구, 에러 핸들링 등이 아직 완성되지 않았습니다.
> 프로덕션 환경에서 사용하지 마시고, [구현 상태](#구현-상태) 섹션을 반드시 확인해주세요.

GAI는 Vision Language Model(VLM)과 OCR을 활용하여 GUI를 자동으로 이해하고 조작하는 에이전트 시스템입니다. MCP(Model Context Protocol)가 지원되지 않는 서비스에서도 에이전트가 GUI를 통해 직접 상호작용할 수 있도록 설계되었습니다.

## 핵심 특징

### 🧠 Navigation Brain (네비게이션 브레인)
VLM이 GUI 경로를 학습하여 그래프 구조로 저장하고 재사용합니다:
- **첫 방문**: VLM이 화면을 분석하고 액션 시퀀스 생성 (3-5초, 비용 발생)
- **재방문**: 저장된 경로를 자동 실행 (<2초, VLM 호출 없음)
- **비용 절감**: 한 번 학습한 경로는 JSON 파일에 영속화되어 VLM 비용 최소화

### 👁️ Vision + OCR 하이브리드
두 기술을 결합하여 정확도와 비용을 최적화:
- **OCR**: 정확한 텍스트 추출 + BBox 좌표 (macOS Vision Framework)
- **VLM**: 시각적 이해 + 버튼/아이콘 인식 + 맥락 파악

### 🎚️ 멀티모드 LLM 시스템
작업에 따라 적절한 LLM을 선택하여 비용과 성능 최적화:
- **Default 모드**: Sonnet 4.5 ($3/1M 토큰) - 일반 에이전트 루프
- **Fast 모드**: Haiku 4.5 ($0.25/1M 토큰) - 빠른 작업 처리
- **Vision 모드**: Opus 4.6 ($15/1M 토큰) - 화면 분석 및 학습

### 🛠️ 12개의 GUI 도구
- **Vision Tools (4개)**: SmartScreenReader, ScreenCapture, OCR, ScreenReader
- **Action Tools (5개)**: Click, Type, KeyPress, TabNavigate, Spotlight
- **Brain Tools (3개)**: NavigateTo, GetCurrentNode, LaunchApp

### 🔌 Multi-LLM Support
4개의 LLM 제공자 지원:
- ✅ **Anthropic** (Claude) - 도구 호출 완전 지원
- ✅ **OpenAI** (GPT) - 도구 호출 완전 지원
- ✅ **Google** (Gemini) - 도구 호출 미지원 (텍스트만)
- ✅ **Ollama** (로컬 모델) - 도구 호출 미지원 (텍스트만)

### 🎯 추가 기능
- 🤖 **Agentic AI**: 자율 에이전트 기능 (최대 10회 반복)
- 💉 **Dependency Injection**: GUI 툴이 LLM을 주입받아 Vision API 활용
- ⚙️ **ENV-based Config**: 환경변수 우선 3계층 설정 시스템
- 🖱️ **완전한 GUI 제어**: 마우스, 키보드, 화면 캡처
- 🌍 **크로스 플랫폼**: macOS (완전 지원), Windows (개발 예정)

## Quick Start

> ⚠️ **시작하기 전에**: 이 프로젝트는 개발 중이므로 예상치 못한 버그나 불안정한 동작이 있을 수 있습니다.

### 1. 필수 요구사항

- **Node.js 18** 이상
- **macOS** (Windows는 개발 예정, 현재 미지원)
- **API 키**: Anthropic, OpenAI, Google 중 하나 이상

### 2. 설치

```bash
# 저장소 클론
git clone <repository-url>
cd GAI

# 의존성 설치
npm install

# 빌드
npm run build
```

### 3. 설정

`.env` 파일을 생성하고 API 키를 설정합니다:

```bash
# .env 파일 생성
cp config/.env.example .env

# .env 파일 편집
nano .env
```

#### 단일 모드 설정 (간단)

```bash
# 단일 LLM만 사용
LLM_PROVIDER=anthropic
LLM_MODEL=claude-sonnet-4-5-20250929
ANTHROPIC_API_KEY=sk-ant-...
```

#### 멀티모드 설정 (권장)

```bash
# Default 모드 (필수)
DEFAULT_PROVIDER=anthropic
DEFAULT_MODEL=claude-sonnet-4-5-20250929

# Fast 모드 (선택)
FAST_PROVIDER=anthropic
FAST_MODEL=claude-haiku-4-5-20251001

# Vision 모드 (선택)
VISION_PROVIDER=anthropic
VISION_MODEL=claude-opus-4-6

# API 키
ANTHROPIC_API_KEY=sk-ant-...

# 에이전트 설정
AGENT_MAX_ITERATIONS=10
```

#### Ollama 사용 (로컬 모델)

```bash
DEFAULT_PROVIDER=ollama
DEFAULT_MODEL=gpt-oss:120b
OLLAMA_BASE_URL=http://localhost:11434

FAST_PROVIDER=ollama
FAST_MODEL=gpt-oss:20b

VISION_PROVIDER=ollama
VISION_MODEL=qwen2.5vl:32b
```

### 4. macOS 권한 설정

처음 실행 시 다음 권한이 필요합니다:

1. **System Preferences > Security & Privacy > Privacy**
2. **Accessibility** 탭: 사용 중인 터미널 앱 추가
3. **Screen Recording** 탭: 동일한 터미널 앱 추가

### 5. 실행

```bash
# 일회성 명령 실행
npm start "계산기를 열고 2+2를 계산해줘"

# 개발 모드 (대화형)
npm run dev
```

## 아키텍처

### 전체 구조

```
사용자 입력
    ↓
┌─────────────────────────────────────┐
│  Agent (에이전트 루프)               │
│  - 최대 10회 반복                    │
│  - 도구 호출 오케스트레이션          │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  LLM Manager (멀티모드 관리)         │
│  ├─ Mode Selection                  │
│  │  ├─ Default (Sonnet 4.5)        │
│  │  ├─ Fast (Haiku 4.5)            │
│  │  └─ Vision (Opus 4.6)           │
│  └─ Providers                       │
│     ├─ AnthropicLLM                 │
│     ├─ OpenAILLM                    │
│     ├─ GoogleLLM                    │
│     └─ OllamaLLM                    │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Tool Registry (도구 관리)          │
│  ├─ Vision Tools (4개)              │
│  ├─ Action Tools (5개)              │
│  └─ Brain Tools (3개)               │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Navigation Brain (경로 학습)       │
│  ├─ VLM Analyzer (화면 분석)        │
│  ├─ State Hasher (상태 해싱)        │
│  └─ JSON Storage (영속성)           │
└─────────────────────────────────────┘
```

### 핵심 설계 원칙

- **Dependency Injection**: GUI 도구가 LLM 인스턴스를 주입받아 Vision API 활용
- **Provider-native History**: 각 LLM 제공자가 자체 히스토리 관리
- **ENV-first Configuration**: 환경변수 → JSON 파일 → 기본값 순으로 우선순위
- **Plugin System**: 새로운 도구를 쉽게 추가 가능
- **Graph-based Navigation**: 화면 네비게이션을 그래프 구조로 저장 및 재사용

### 데이터 흐름

```
사용자: "계산기를 열고 2+2를 계산해줘"
    ↓
[초기화]
1. 권한 확인 (macOS Accessibility + Screen Recording)
2. 설정 로드 (.env + config.json)
3. LLMManager 초기화 (3개 모드 설정)
4. NavigationBrain 초기화 (JSON에서 그래프 로드)
5. 12개 도구 등록
    ↓
[에이전트 루프 - 반복 1]
6. LLM: "launch_app({ appName: 'Calculator' })"
7. Tool 실행: LaunchAppTool
8. 결과 → LLM
    ↓
[반복 2]
9. LLM: "type_text({ text: '2+2' })" + "press_key({ key: 'enter' })"
10. Tool 실행: TypeTool, KeyPressTool
11. 결과 → LLM
    ↓
[반복 3]
12. LLM: (도구 호출 없음) "결과는 4입니다"
13. 최종 응답 반환
    ↓
[정리]
14. 세션 종료 및 출력
```

## 프로젝트 구조

```
GAI/
├── src/                          # 소스 코드 (43개 파일, ~6,113줄)
│   ├── core/                     # 코어 시스템 (3개 파일)
│   │   ├── Agent.ts              # 에이전트 루프 (156줄)
│   │   ├── ToolRegistry.ts       # 도구 레지스트리 (91줄)
│   │   └── types.ts              # 타입 정의 43개 (211줄)
│   │
│   ├── brain/                    # 네비게이션 브레인 (7개 파일, 757줄)
│   │   ├── NavigationBrain.ts    # 핵심 로직 (757줄) ⭐
│   │   ├── types.ts              # 브레인 타입 (279줄)
│   │   ├── utils/                # 유틸리티
│   │   │   ├── VLMAnalyzer.ts    # VLM 분석 래퍼 (268줄)
│   │   │   └── StateHasher.ts    # 상태 해싱 (103줄)
│   │   ├── storage/              # 영속성
│   │   │   ├── BrainStorage.ts   # 추상 인터페이스 (67줄)
│   │   │   └── JSONStorage.ts    # JSON 구현 (256줄)
│   │   └── tools/                # 브레인 도구 (3개)
│   │       ├── NavigateToTool.ts      # 네비게이션 (85줄)
│   │       ├── GetCurrentNodeTool.ts  # 현재 노드 (82줄)
│   │       └── LaunchAppTool.ts       # 앱 실행 (106줄)
│   │
│   ├── llm/                      # LLM 시스템 (9개 파일)
│   │   ├── LLMManager.ts         # 멀티모드 관리 (181줄)
│   │   ├── base/                 # 기반 클래스
│   │   │   ├── BaseLLM.ts        # 추상 LLM (68줄)
│   │   │   ├── BaseLLMAdapter.ts # 레거시 어댑터 (57줄)
│   │   │   └── types.ts          # LLM 타입 (63줄)
│   │   └── providers/            # LLM 제공자 (4개)
│   │       ├── AnthropicLLM.ts   # Claude (283줄)
│   │       ├── OpenAILLM.ts      # GPT (288줄)
│   │       ├── GoogleLLM.ts      # Gemini (246줄)
│   │       └── OllamaLLM.ts      # Ollama (233줄)
│   │
│   ├── tools/                    # 도구 시스템 (13개 파일)
│   │   ├── ToolBase.ts           # 추상 도구 (56줄)
│   │   └── gui/
│   │       ├── vision/           # 비전 도구 (4개)
│   │       │   ├── SmartScreenReader.ts  # 스마트 리더 (170줄)
│   │       │   ├── ScreenCapture.ts      # 화면 캡처
│   │       │   ├── OCR.ts                # OCR
│   │       │   └── ScreenReader.ts       # 레거시 리더
│   │       ├── action/           # 액션 도구 (5개)
│   │       │   ├── Click.ts              # 클릭 (166줄)
│   │       │   ├── Type.ts               # 타이핑 (86줄)
│   │       │   ├── KeyPress.ts           # 키 입력 (89줄)
│   │       │   ├── TabNavigate.ts        # Tab 탐색 (81줄)
│   │       │   └── Spotlight.ts          # Spotlight (96줄)
│   │       └── Echo.ts           # 테스트 도구 (51줄)
│   │
│   ├── config/                   # 설정 시스템 (1개 파일)
│   │   └── ConfigLoader.ts       # 3계층 로더 (300줄)
│   │
│   ├── utils/                    # 유틸리티 (9개 파일)
│   │   ├── automation/           # GUI 자동화
│   │   │   ├── MouseController.ts       # 마우스 (118줄)
│   │   │   ├── KeyboardController.ts    # 키보드 (193줄)
│   │   │   └── CoordinateConverter.ts   # 좌표 변환 (68줄)
│   │   ├── ocr/                  # OCR 시스템
│   │   │   ├── OCRProvider.ts           # 추상 인터페이스 (20줄)
│   │   │   ├── MacOCRProvider.ts        # macOS 구현 (80줄)
│   │   │   └── OCRFactory.ts            # 팩토리 (42줄)
│   │   ├── permissions/          # 권한 관리
│   │   │   └── MacPermissions.ts        # macOS 권한 (60줄)
│   │   ├── platform.ts           # 플랫폼 감지 (30줄)
│   │   └── delay.ts              # 지연 유틸 (5줄)
│   │
│   └── index.ts                  # 진입점 (178줄)
│
├── data/                         # 데이터 디렉토리
│   └── brain/
│       └── navigation.json       # 학습된 네비게이션 그래프
│
├── config/                       # 설정 디렉토리
│   ├── config.json               # JSON 설정 (선택)
│   └── .env.example              # 환경변수 예시
│
├── docs/                         # 문서 (10개 파일)
│   ├── 00-개요.md                # 프로젝트 개요
│   ├── 01-아키텍처.md            # 아키텍처 설계
│   ├── 02-코어시스템.md          # Agent, ToolRegistry
│   ├── 03-브레인시스템.md        # NavigationBrain ⭐
│   ├── 04-LLM시스템.md           # LLMManager + 제공자
│   ├── 05-도구시스템.md          # 12개 도구 상세
│   ├── 06-설정시스템.md          # ConfigLoader
│   ├── 07-유틸리티.md            # Automation, OCR
│   ├── 08-초기화.md              # 진입점 및 초기화
│   └── 09-데이터흐름.md          # 데이터 흐름
│
├── tests/                        # 테스트 (개발 예정)
├── .env                          # 환경변수 (생성 필요)
├── package.json
├── tsconfig.json
└── README.md                     # 본 문서
```

**총 43개 파일, 약 6,113줄의 TypeScript 코드**

## 구현 상태

### ✅ 완전 구현

#### 코어 시스템
- [x] 타입 시스템 (43개 exported types)
- [x] Agent (에이전트 루프, 최대 10회 반복)
- [x] ToolRegistry (도구 관리 시스템)

#### LLM 시스템
- [x] LLMManager (멀티모드 관리)
- [x] AnthropicLLM (도구 호출 지원)
- [x] OpenAILLM (도구 호출 지원)
- [x] GoogleLLM (텍스트만)
- [x] OllamaLLM (텍스트만)
- [x] Provider-native history management

#### 네비게이션 브레인 ⭐
- [x] NavigationBrain (경로 학습 및 실행)
- [x] VLMAnalyzer (화면 분석)
- [x] StateHasher (상태 해싱)
- [x] JSONStorage (영속성)

#### GUI 도구 (12개)
- [x] Vision Tools (4개): SmartScreenReader, ScreenCapture, OCR, ScreenReader
- [x] Action Tools (5개): Click, Type, KeyPress, TabNavigate, Spotlight
- [x] Brain Tools (3개): NavigateTo, GetCurrentNode, LaunchApp

#### 설정 및 유틸리티
- [x] ConfigLoader (3계층 설정)
- [x] MouseController (마우스 자동화)
- [x] KeyboardController (키보드 자동화)
- [x] MacOCRProvider (macOS Vision Framework)
- [x] MacPermissions (권한 관리)

#### 플랫폼 지원
- [x] macOS (완전 지원)

### 🚧 미완성 / 개발 예정

> ⚠️ **주의**: 아래 기능들은 아직 구현되지 않았습니다.

#### 높은 우선순위
- [ ] **테스트 코드** (유닛 테스트, 통합 테스트)
- [ ] **Windows OCR 제공자** (macOS만 지원)
- [ ] **에러 핸들링 개선** (현재 기본적인 수준)
- [ ] **로깅 시스템** (디버깅 도구)

#### 중간 우선순위
- [ ] **Scroll, Drag 도구** (마우스 제스처)
- [ ] **SQLite/벡터 DB 지원** (현재 JSON만)
- [ ] **경로 최적화** (A* 알고리즘)
- [ ] **텔레그램 봇 모듈** (원격 제어)

#### 낮은 우선순위
- [ ] **성능 최적화** (캐싱, 병렬화)
- [ ] **문서 개선** (API 문서, 튜토리얼)
- [ ] **CI/CD 파이프라인**

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

## 핵심 개념

### 1. 노드 (Node) vs 섀도우DOM (ShadowDOM)

#### 노드 (Node)
정적인 "장소" 개념으로 GUI의 특정 상태를 나타냅니다:
- **식별**: 프로그램명 + 상태 해시 (SHA-256)
- **저장**: JSON 파일에 영구 저장
- **예시**: `{ programName: "Chrome", stateHash: "abc123..." }`
- **목적**: 네비게이션 그래프의 정점(vertex)

#### 섀도우DOM (ShadowDOM)
런타임 스냅샷으로 현재 화면 상태를 캡처한 것입니다:
- **구성**: 스크린샷 + UI 요소 + OCR 결과 + 인스턴스 해시
- **휘발성**: 메모리에만 존재 (파일에 저장되지 않음)
- **목적**: 현재 화면 분석 및 액션 실행 검증

### 2. 경로 학습 및 재사용

```
첫 번째 실행: "시스템 환경설정의 디스플레이로 이동"
  ↓
1. VLM이 현재 화면 분석 (Vision mode, 비용 발생)
2. VLM이 액션 시퀀스 생성:
   - click("System Preferences")
   - wait(1000)
   - click("Displays")
3. 각 액션 실행 및 검증
4. Path를 JSON에 저장 (fromNodeId → toNodeId)
  ↓
비용: $0.15 (Vision mode 사용)
시간: 5초

두 번째 실행: "다시 디스플레이로 이동"
  ↓
1. JSON에서 기존 Path 발견
2. VLM 호출 없이 저장된 액션 시퀀스 실행
3. OCR로 도착 검증만 수행
  ↓
비용: $0.00 (VLM 미사용)
시간: 2초

결과: 비용 100% 절감, 속도 150% 향상!
```

### 3. OCR + VLM 시너지

두 기술을 결합하여 정확도와 비용을 최적화:

| 기술 | 장점 | 단점 | 사용 시점 |
|------|------|------|-----------|
| **OCR** | 정확한 텍스트 + BBox 좌표, 빠름, 저렴 | 버튼/아이콘 인식 불가 | 텍스트 기반 작업 |
| **VLM** | 시각적 이해, 버튼/아이콘 인식, 맥락 파악 | 느림, 비쌈 | 화면 분석, 경로 학습 |

**하이브리드 전략**:
1. OCR로 텍스트 추출 (빠르고 저렴)
2. OCR 결과를 VLM에 컨텍스트로 제공 (VLM 토큰 절감)
3. VLM이 시각적 요소와 텍스트를 결합하여 분석

## 설정 시스템

### 3계층 우선순위

```
1. 환경변수 (.env 또는 시스템) ← 최우선
   ↓
2. JSON 파일 (config/config.json) ← fallback
   ↓
3. 기본값 (코드 내부) ← 마지막 fallback
```

### Fallback 시스템

FAST/VISION 모드가 설정되지 않으면 DEFAULT를 사용:

```bash
# Case 1: DEFAULT만 설정
# → 모든 모드에서 DEFAULT 사용
DEFAULT_PROVIDER=anthropic
DEFAULT_MODEL=claude-sonnet-4-5-20250929
ANTHROPIC_API_KEY=sk-ant-...

# Case 2: DEFAULT + FAST 설정
# → FAST는 Haiku, VISION은 DEFAULT(Sonnet) 사용
DEFAULT_PROVIDER=anthropic
DEFAULT_MODEL=claude-sonnet-4-5-20250929
FAST_PROVIDER=anthropic
FAST_MODEL=claude-haiku-4-5-20251001
ANTHROPIC_API_KEY=sk-ant-...

# Case 3: 모든 모드 개별 설정 (권장)
# → 각 모드별 최적화된 모델 사용
DEFAULT_PROVIDER=anthropic
DEFAULT_MODEL=claude-sonnet-4-5-20250929
FAST_PROVIDER=anthropic
FAST_MODEL=claude-haiku-4-5-20251001
VISION_PROVIDER=anthropic
VISION_MODEL=claude-opus-4-6
ANTHROPIC_API_KEY=sk-ant-...
```

### JSON 파일 설정 (선택)

`config/config.json`:

```json
{
  "llm": {
    "default": {
      "provider": "anthropic",
      "model": "claude-sonnet-4-5-20250929",
      "maxTokens": 8096,
      "temperature": 0.7
    },
    "fast": {
      "provider": "anthropic",
      "model": "claude-haiku-4-5-20251001",
      "maxTokens": 4096,
      "temperature": 0.5
    },
    "vision": {
      "provider": "anthropic",
      "model": "claude-opus-4-6",
      "maxTokens": 8096,
      "temperature": 0.7
    }
  },
  "agent": {
    "maxIterations": 10
  }
}
```

**주의**: `.env` 파일의 환경변수가 `config.json`보다 우선합니다!

## GUI 자동화

### macOS 권한 설정

GUI 자동화를 사용하려면 macOS에서 다음 권한이 필요합니다:

1. **System Preferences > Security & Privacy > Privacy**
2. **Accessibility** 탭:
   - 사용 중인 터미널 앱(Terminal, iTerm2 등) 추가
   - 체크박스 활성화
3. **Screen Recording** 탭:
   - 동일한 터미널 앱 추가
   - 체크박스 활성화

처음 실행 시 시스템이 자동으로 권한을 요청합니다. 권한이 없으면 에러 메시지와 함께 종료됩니다.

### Navigation Brain (네비게이션 브레인)

Navigation Brain은 GUI 네비게이션 경로를 학습하고 재사용하는 핵심 시스템입니다.

#### 작동 원리

```
현재 노드(A) → 목표 노드(B)로 이동 요청
    ↓
[1단계: 경로 탐색]
기존 Path 존재?
    ├─ Yes → 저장된 액션 시퀀스 실행 (빠름, 저렴)
    └─ No  → 2단계로 진행
    ↓
[2단계: 경로 학습]
VLM이 화면 분석
    ↓
VLM이 액션 시퀀스 생성
    예: [click("Settings"), wait(500), click("Display")]
    ↓
각 액션 실행 + 검증 (OCR + VLM)
    ↓
성공하면 Path 저장 (JSON)
    ↓
[3단계: 재사용]
다음번 동일 요청 시 1단계에서 바로 실행
```

#### 주요 특징

- **첫 방문**: VLM 분석 + 학습 (3-5초, 비용 발생)
- **재방문**: 저장된 경로 실행 (<2초, VLM 미사용)
- **실패 시 재학습**: 경로 실행 실패 시 자동으로 VLM 재학습
- **영속성**: `data/brain/navigation.json`에 그래프 저장
- **검증**: 각 액션 후 OCR + VLM으로 결과 확인

### 도구 시스템 (12개)

#### Vision Tools (눈) - 화면 이해

| 도구 | 설명 | 입력 | 출력 |
|------|------|------|------|
| `smart_screen_reader` | 화면 분석 (2가지 모드) | `mode: 'quick' \| 'detailed'` | 화면 설명 텍스트 |
| `capture_screen` | 화면 캡처 | 없음 | base64 이미지 + 메타데이터 |
| `ocr` | OCR 텍스트 인식 | `imagePath?` (선택) | 텍스트 + BBox 배열 |

**SmartScreenReader 모드**:
- `quick`: Fast mode LLM 사용 (빠름, 저렴, OCR 없음)
- `detailed`: Vision mode LLM + OCR (정확, 비쌈)

#### Action Tools (손) - GUI 조작

| 도구 | 설명 | 입력 | 출력 |
|------|------|------|------|
| `click` | 클릭 (좌표/텍스트) | `x, y` 또는 `text` | 성공 여부 |
| `type_text` | 텍스트 입력 | `text, pressEnter?, delay?` | 성공 여부 |
| `press_key` | 키보드 입력 | `key, modifiers?` | 성공 여부 |
| `tab_navigate` | Tab 탐색 | `count?, reverse?` | 성공 여부 |
| `spotlight` | Spotlight 실행 | `query, pressEnter?` | 성공 여부 |

**Click 도구 예시**:
```typescript
// 좌표 기반 클릭
click({ x: 100, y: 200 })

// 텍스트 기반 클릭 (OCR 자동 실행)
click({ text: "Submit" })
```

**KeyPress 예시**:
```typescript
// 단순 키 입력
press_key({ key: "enter" })

// 단축키 (Cmd+C)
press_key({ key: "c", modifiers: ["command"] })

// 복합 단축키 (Cmd+Shift+S)
press_key({ key: "s", modifiers: ["command", "shift"] })
```

#### Brain Tools (뇌) - 지능형 네비게이션

| 도구 | 설명 | 입력 | 출력 |
|------|------|------|------|
| `navigate_to` | 목표 화면으로 이동 | `target: string` | 성공 여부 |
| `get_current_node` | 현재 노드 조회 | 없음 | NodeId + ShadowDOM |
| `launch_app` | 앱 실행 | `appName: string` | 성공 여부 |

**NavigateTo 예시**:
```typescript
// 자연어로 목표 설명
navigate_to({ target: "System Preferences의 Display 설정" })

// 첫 방문: VLM이 경로 학습
// 재방문: 저장된 경로 재사용
```

### Spotlight 노드

Spotlight는 특별한 **기본 노드**로 취급됩니다:

- **NodeId**: `{ programName: "Spotlight", stateHash: "spotlight" }`
- **접근**: `Cmd+Space` (언제든지 접근 가능)
- **용도**: 앱 실행의 시작점
- **종료**: `Cmd+Q` 또는 `Esc`로 Spotlight 닫기
- **검증**: OCR로 "Spotlight Search" 텍스트 확인

**LaunchApp 흐름**:
```
1. launch_app({ appName: "Calculator" })
    ↓
2. Spotlight 노드로 이동 (Cmd+Space)
    ↓
3. "Calculator" 타이핑
    ↓
4. Enter 키 입력
    ↓
5. 앱 실행 확인 (identifyCurrentNode)
```

## 사용 예시

### 기본 사용

```bash
# 화면 캡처
npm start "현재 화면을 캡처해서 보여줘"

# OCR 텍스트 인식
npm start "화면에 있는 모든 텍스트를 읽어줘"

# 화면 분석 (quick mode)
npm start "지금 화면이 뭔지 빠르게 알려줘"

# 화면 분석 (detailed mode)
npm start "현재 화면을 상세하게 분석해줘"
```

### GUI 조작

```bash
# 텍스트 기반 클릭
npm start "'Submit' 버튼을 클릭해줘"

# 좌표 기반 클릭
npm start "화면의 (100, 200) 위치를 클릭해줘"

# 텍스트 입력
npm start "'Hello World'를 입력해줘"

# 키보드 단축키
npm start "Cmd+C를 눌러줘"

# Tab 탐색
npm start "Tab을 3번 눌러줘"
```

### Navigation Brain 사용

```bash
# 첫 방문: VLM이 경로 학습 (3-5초)
npm start "시스템 환경설정의 디스플레이 설정으로 가줘"

# 재방문: 저장된 경로 재사용 (<2초, VLM 미사용)
npm start "다시 디스플레이 설정으로 가줘"

# Finder 네비게이션
npm start "Finder에서 Desktop 폴더로 이동해줘"

# Chrome 네비게이션
npm start "Chrome 설정 페이지를 열어줘"
```

### 앱 실행 (Spotlight)

```bash
# 계산기 실행
npm start "Calculator 열어줘"

# 터미널 실행
npm start "Terminal 실행해줘"

# VS Code 실행
npm start "Visual Studio Code 켜줘"
```

### 복합 작업

```bash
# 계산기로 계산
npm start "계산기를 열고 2+2를 계산해줘"

# 파일 찾기 및 열기
npm start "Finder에서 Documents 폴더를 열고 README.md 파일을 찾아줘"

# 웹 검색
npm start "Chrome을 열고 'anthropic claude'를 검색해줘"
```

### 실행 예시 (상세)

```bash
$ npm start "계산기를 열고 2+2를 계산해줘"

[초기화]
✓ macOS 권한 확인 완료
✓ 설정 로드 완료
✓ LLMManager 초기화 (3 modes)
✓ NavigationBrain 초기화
✓ 12개 도구 등록 완료

[에이전트 루프]
[1] LLM: launch_app({ appName: "Calculator" })
    → LaunchAppTool 실행
    → Spotlight로 Calculator 실행
    ✓ 성공

[2] LLM: type_text({ text: "2+2" })
    → TypeTool 실행
    ✓ 성공

[3] LLM: press_key({ key: "enter" })
    → KeyPressTool 실행
    ✓ 성공

[4] LLM: (도구 호출 없음)
    → 최종 응답 생성

[응답]
계산기를 열고 2+2를 계산했습니다. 결과는 4입니다.

[세션 종료]
✓ 완료 (총 4회 반복, 8초 소요)
```

### 테스트 (개발 예정)

```bash
# 유닛 테스트 실행
npm test

# Calculator 통합 테스트 (macOS 전용)
npm test calculator

# 커버리지 확인
npm run test:coverage
```

## 상세 문서

각 시스템에 대한 상세한 문서는 [`docs/`](docs/) 디렉토리에서 확인할 수 있습니다:

### 필수 문서

- **[00-개요.md](docs/00-개요.md)**: 프로젝트 전체 개요 및 실행 흐름
- **[01-아키텍처.md](docs/01-아키텍처.md)**: 아키텍처 설계, 디자인 패턴, 의존성 그래프

### 시스템별 문서

- **[02-코어시스템.md](docs/02-코어시스템.md)**: Agent, ToolRegistry, 타입 시스템
- **[03-브레인시스템.md](docs/03-브레인시스템.md)** ⭐: NavigationBrain 완전 가이드 (가장 중요)
- **[04-LLM시스템.md](docs/04-LLM시스템.md)**: LLMManager 및 4개 제공자 상세
- **[05-도구시스템.md](docs/05-도구시스템.md)**: 12개 도구 API 레퍼런스
- **[06-설정시스템.md](docs/06-설정시스템.md)**: ConfigLoader 및 설정 방법
- **[07-유틸리티.md](docs/07-유틸리티.md)**: Automation, OCR, 권한 유틸리티

### 기타 문서

- **[08-초기화.md](docs/08-초기화.md)**: 진입점 및 초기화 시퀀스
- **[09-데이터흐름.md](docs/09-데이터흐름.md)**: 데이터 흐름 및 시스템 상호작용

**추천 읽기 순서**:
1. 00-개요.md (전체 이해)
2. 03-브레인시스템.md (핵심 메커니즘)
3. 05-도구시스템.md (도구 사용법)
4. 04-LLM시스템.md (LLM 설정)

## 확장 가능성

GAI는 확장 가능한 아키텍처로 설계되어 새로운 기능을 쉽게 추가할 수 있습니다.

### 새로운 LLM 제공자 추가

`BaseLLM`을 상속하여 새로운 제공자를 구현:

```typescript
// src/llm/providers/NewProviderLLM.ts
import { BaseLLM } from '../base/BaseLLM';
import { LLMConfig, LLMResponse } from '../base/types';

export class NewProviderLLM extends BaseLLM {
  async send(tools?: ToolDefinition[]): Promise<LLMResponse> {
    // 구현
  }

  async *stream(tools?: ToolDefinition[]): AsyncIterableIterator<LLMStreamChunk> {
    // 구현
  }
}
```

### 새로운 도구 추가

`ToolBase`를 상속하여 새로운 도구를 구현:

```typescript
// src/tools/gui/action/NewTool.ts
import { ToolBase } from '../../ToolBase';

export class NewTool extends ToolBase {
  name = 'new_tool';
  description = '새로운 도구 설명';

  inputSchema = {
    type: 'object',
    properties: {
      param1: { type: 'string', description: '파라미터 1' }
    },
    required: ['param1']
  };

  async execute(input: { param1: string }): Promise<ToolResult> {
    // 구현
    return { success: true, data: '결과' };
  }
}
```

### 새로운 스토리지 백엔드 추가

`BrainStorage`를 구현하여 새로운 스토리지를 추가:

```typescript
// src/brain/storage/PostgreSQLStorage.ts
import { BrainStorage } from './BrainStorage';

export class PostgreSQLStorage implements BrainStorage {
  async load(): Promise<SerializableNavigationGraph | null> {
    // PostgreSQL에서 로드
  }

  async save(graph: SerializableNavigationGraph): Promise<void> {
    // PostgreSQL에 저장
  }

  // 기타 메서드 구현
}
```

### 확장 아이디어

#### 플랫폼 확장
- [ ] **Windows OCR**: Windows.Media.Ocr API 래퍼
- [ ] **Linux OCR**: Tesseract 또는 EasyOCR 통합

#### LLM 확장
- [ ] **Grok**: xAI의 Grok 모델 지원
- [ ] **Claude**: Anthropic의 최신 모델 지원
- [ ] **Custom LLM**: 자체 호스팅 모델 지원

#### 도구 확장
- [ ] **ScrollTool**: 화면 스크롤
- [ ] **DragTool**: 드래그 앤 드롭
- [ ] **DropDownTool**: 드롭다운 메뉴 조작
- [ ] **FileUploadTool**: 파일 업로드
- [ ] **ContextMenuTool**: 우클릭 메뉴

#### 스토리지 확장
- [ ] **SQLite**: 로컬 데이터베이스
- [ ] **PostgreSQL**: 원격 데이터베이스
- [ ] **MongoDB**: NoSQL 데이터베이스
- [ ] **Vector DB**: 벡터 유사도 기반 경로 탐색

#### 알고리즘 확장
- [ ] **A* 경로 탐색**: 최적 경로 자동 발견
- [ ] **강화학습**: 경로 성공률 학습 및 최적화
- [ ] **유사도 매칭**: 비슷한 화면 상태 자동 매칭

#### UI 확장
- [ ] **텔레그램 봇**: 원격에서 GUI 제어
- [ ] **웹 대시보드**: 브라우저에서 모니터링
- [ ] **VS Code 확장**: IDE 통합

## 개발

### 개발 환경 설정

```bash
# 저장소 클론
git clone <repository-url>
cd GAI

# 의존성 설치
npm install

# .env 파일 설정
cp config/.env.example .env
nano .env
```

### 개발 모드

```bash
# tsx로 즉시 실행 (빌드 불필요)
npm run dev

# 일회성 명령 실행
npm run dev "화면 캡처해줘"
```

### 빌드

```bash
# TypeScript 컴파일
npm run build

# 빌드 결과 확인
ls dist/
```

### 프로덕션 실행

```bash
# 빌드 후 실행
npm run build
npm start "계산기 열어줘"
```

### 디버깅

```bash
# 로그 레벨 설정 (개발 예정)
DEBUG=* npm run dev

# 특정 모듈만 디버그
DEBUG=brain,llm npm run dev
```

### 코드 품질

```bash
# 린트 검사 (개발 예정)
npm run lint

# 포맷팅 (개발 예정)
npm run format

# 타입 체크
npx tsc --noEmit
```

## 기여

이슈 및 풀 리퀘스트를 환영합니다!

### 기여 가이드라인

1. **이슈 생성**: 버그 리포트 또는 기능 요청
2. **Fork**: 저장소 포크
3. **브랜치 생성**: `git checkout -b feature/amazing-feature`
4. **커밋**: `git commit -m 'Add amazing feature'`
5. **푸시**: `git push origin feature/amazing-feature`
6. **PR 생성**: Pull Request 생성

### 개발 우선순위

1. **Windows 지원** (높음)
2. **테스트 코드** (높음)
3. **텔레그램 봇** (중간)
4. **새로운 도구** (중간)
5. **문서 개선** (지속적)

## 라이선스

MIT License

## 문의

문제가 발생하거나 질문이 있으시면 [이슈](https://github.com/<username>/GAI/issues)를 생성해주세요.

---

**GAI (Graphic Agent Interface)**
비전 LLM과 OCR로 GUI를 이해하고 자동화하는 지능형 에이전트 시스템
Made with ❤️ by [Your Name]
