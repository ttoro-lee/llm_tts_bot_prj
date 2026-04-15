# LLM TTS Bot

LLM 챗봇 응답을 실시간 TTS로 음성 출력하는 웹 애플리케이션입니다.

## 주요 기능

- **LLM 챗팅**: Ollama 기반 로컬 LLM과 대화
- **TTS 음성 출력**: 응답을 edge-tts(Microsoft Edge TTS)로 자동 음성 재생
- **오디오 비주얼라이저**: Web Audio API 기반 원형 주파수 시각화
- **웹 UI**: 좌측 설정 패널 / 중앙 비주얼라이저 / 우측 채팅 내역
- **실시간 설정**: 브라우저에서 모델 선택 및 시스템 프롬프트 변경 가능

## 요구사항

- Python 3.12+
- [uv](https://github.com/astral-sh/uv)
- [Ollama](https://ollama.com) (로컬 실행)

## 설치 및 실행

```bash
# 1. 의존성 설치
uv sync

# 2. 환경 변수 설정
cp .env.example .env
# .env 파일을 열어 원하는 모델 및 설정 입력

# 3. Ollama 모델 준비
ollama pull gemma3:4b   # 또는 원하는 모델

# 4. 서버 실행 (브라우저 자동 오픈)
run.bat
```

또는 직접 실행:

```bash
uv run uvicorn server:app --reload
```

브라우저에서 `http://localhost:8000` 접속

## 환경 변수 (.env)

| 변수 | 기본값 | 설명 |
|---|---|---|
| `SYSTEM_PROMPT` | (없음) | 시스템 프롬프트 |
| `LLM_PROVIDER` | `ollama` | LLM 프로바이더 |
| `LLM_MODEL` | `gemma4` | 사용할 Ollama 모델명 |
| `OLLAMA_HOST` | 로컬 | 원격 Ollama 서버 주소 |
| `TTS_PROVIDER` | `edge` | `edge` 또는 `pyttsx3` |
| `TTS_VOICE` | `ko-KR-SunHiNeural` | edge-tts 보이스 |

사용 가능한 TTS 보이스 목록:

```bash
uv run edge-tts --list-voices
```

## 프로젝트 구조

```
server.py              # FastAPI 서버 (API 라우트)
main.py                # CLI 챗봇 (터미널 전용)
src/
  llm/
    base.py            # BaseLLM 추상 클래스
    ollama_provider.py # Ollama 구현체
  tts/
    base.py            # BaseTTS 추상 클래스
    edge_tts_provider.py  # edge-tts (웹 기본값)
    pyttsx3_provider.py   # pyttsx3 (오프라인 대안)
static/
  index.html           # UI 레이아웃
  style.css            # 스타일
  app.js               # 오디오 재생 및 비주얼라이저
```

## LLM / TTS 교체

새 프로바이더 추가 시 `BaseLLM` 또는 `BaseTTS`를 상속한 클래스를 작성하고, `server.py`의 `/api/chat` 엔드포인트에 분기를 추가합니다.

```python
# 예: 새 LLM 추가
class MyLLM(BaseLLM):
    def chat(self, messages): ...
    def stream_chat(self, messages): ...
```

## CLI 모드

웹 서버 없이 터미널에서 바로 사용할 수도 있습니다.

```bash
uv run python main.py
```
