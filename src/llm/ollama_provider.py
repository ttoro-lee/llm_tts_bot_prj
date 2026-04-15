from typing import Iterator

import ollama

from .base import BaseLLM


class OllamaLLM(BaseLLM):
    """Ollama 로컬 LLM 프로바이더.

    환경변수:
        LLM_MODEL: 사용할 모델명 (기본값: llama3.2)
        OLLAMA_HOST: Ollama 서버 주소 (기본값: http://localhost:11434)
    """

    def __init__(self, model: str = "llama3.2", host: str | None = None):
        self.model = model
        self.client = ollama.Client(host=host) if host else ollama.Client()

    def chat(self, messages: list[dict]) -> str:
        response = self.client.chat(model=self.model, messages=messages)
        return response.message.content

    def stream_chat(self, messages: list[dict]) -> Iterator[str]:
        stream = self.client.chat(model=self.model, messages=messages, stream=True)
        for chunk in stream:
            yield chunk.message.content
