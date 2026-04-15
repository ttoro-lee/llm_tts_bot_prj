# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Goal

LLM 챗봇을 베이스로 하는 음성 발화가 가능한 BOT 생성 프로젝트 — a bot that combines an LLM chatbot with text-to-speech (TTS) output.

## Python Tooling

This project uses [uv](https://github.com/astral-sh/uv) for Python package management and execution.

- Install dependencies: `uv sync`
- Run a script: `uv run python script.py`
- Add a dependency: `uv add <package>`
- Add a dev dependency: `uv add --dev <package>`
- Run a module: `uv run python -m <module>`

Do not use `pip`, `pip install`, or bare `python` commands — always use `uv`.

## Commands

```bash
uv sync                                         # 의존성 설치
uv run uvicorn server:app --reload              # 웹 서버 실행 (http://localhost:8000)
uv run python main.py                           # CLI 챗봇 실행
```

## Architecture

```
server.py             # FastAPI 서버 — /api/models, /api/config, /api/chat
main.py               # CLI 챗봇 진입점 (환경변수로 프로바이더 선택)
static/
  index.html          # 레이아웃 (좌측 사이드바 + 중앙 비주얼라이저 + 하단 입력)
  style.css
  app.js              # Web Audio API 기반 시각화 + 채팅 로직
src/
  llm/
    base.py               # BaseLLM — chat(), stream_chat()
    ollama_provider.py    # Ollama 구현체
  tts/
    base.py               # BaseTTS — speak() (CLI), synthesize() (웹, bytes 반환)
    edge_tts_provider.py  # edge-tts 구현체 (기본)
    pyttsx3_provider.py   # pyttsx3 구현체 (오프라인 대안)
```

**웹 플로우:** 프론트엔드 → `POST /api/chat` → LLM 응답 → edge-tts로 MP3 생성 → base64로 반환 → Web Audio API로 재생하며 주파수 데이터로 원형 비주얼라이저 애니메이션.

새 LLM/TTS 추가 시: `BaseLLM` / `BaseTTS` 상속 후 `server.py`의 `/api/chat` 또는 `main.py`의 `build_*` 함수에 분기 추가.

## Configuration

`.env.example`을 복사해 `.env`로 사용.

| 환경변수 | 기본값 | 설명 |
|---|---|---|
| `LLM_PROVIDER` | `ollama` | LLM 프로바이더 |
| `LLM_MODEL` | `llama3.2` | Ollama 모델명 |
| `OLLAMA_HOST` | (로컬) | 원격 Ollama 서버 주소 |
| `TTS_PROVIDER` | `edge` | `edge` 또는 `pyttsx3` |
| `TTS_VOICE` | `ko-KR-SunHiNeural` | edge-tts 보이스 |

edge-tts 전체 보이스 목록: `uv run edge-tts --list-voices`
