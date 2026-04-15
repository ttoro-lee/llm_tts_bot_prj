import base64
import os

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv
import ollama

load_dotenv()

app = FastAPI()


def _get_default_model() -> str:
    try:
        client = ollama.Client(host=os.getenv("OLLAMA_HOST") or None)
        models = client.list().models
        return models[0].model if models else ""
    except Exception:
        return ""


_config = {
    "model": _get_default_model(),
    "system_prompt": os.getenv("SYSTEM_PROMPT", ""),
    "tts_voice": os.getenv("TTS_VOICE", "ko-KR-SunHiNeural"),
}


# ── Models ──────────────────────────────────────────────────────────────────

@app.get("/api/models")
def get_models():
    try:
        client = ollama.Client(host=os.getenv("OLLAMA_HOST") or None)
        result = client.list()
        return {"models": [m.model for m in result.models]}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Ollama 연결 실패: {e}")


# ── Config ───────────────────────────────────────────────────────────────────

@app.get("/api/config")
def get_config():
    return _config


class ConfigUpdate(BaseModel):
    model: str | None = None
    system_prompt: str | None = None


@app.post("/api/config")
def update_config(data: ConfigUpdate):
    if data.model is not None:
        _config["model"] = data.model
    if data.system_prompt is not None:
        _config["system_prompt"] = data.system_prompt
    return _config


# ── Chat ─────────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []
    model: str | None = None


@app.post("/api/chat")
async def chat(req: ChatRequest):
    from src.llm.ollama_provider import OllamaLLM
    from src.tts.edge_tts_provider import EdgeTTS

    messages: list[dict] = []
    if _config["system_prompt"]:
        messages.append({"role": "system", "content": _config["system_prompt"]})
    messages.extend(req.history)
    messages.append({"role": "user", "content": req.message})

    llm = OllamaLLM(
        model=req.model or _config["model"],
        host=os.getenv("OLLAMA_HOST") or None,
    )
    try:
        response = llm.chat(messages)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"LLM 오류: {e}")

    tts = EdgeTTS(voice=_config["tts_voice"])
    try:
        audio_bytes = await tts.synthesize(response)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"TTS 오류: {e}")

    return {
        "response": response,
        "audio": base64.b64encode(audio_bytes).decode(),
    }


# ── Static (must be last) ─────────────────────────────────────────────────────

app.mount("/", StaticFiles(directory="static", html=True), name="static")
