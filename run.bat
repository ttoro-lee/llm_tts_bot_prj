@echo off
echo Starting LLM TTS Bot...
start http://localhost:8000
uv run uvicorn server:app --reload
