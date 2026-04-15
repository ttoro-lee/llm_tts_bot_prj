import asyncio
import os
import tempfile

import pyttsx3

from .base import BaseTTS


class Pyttsx3TTS(BaseTTS):
    """pyttsx3 오프라인 TTS 프로바이더.

    네트워크 없이 동작하나 시스템 설치 음성에 따라 한국어 지원이 제한될 수 있음.
    환경변수:
        TTS_RATE:   말하기 속도 (기본값: 150)
        TTS_VOLUME: 볼륨 0.0~1.0 (기본값: 1.0)
    """

    def __init__(self, rate: int = 150, volume: float = 1.0, voice_id: str | None = None):
        self.engine = pyttsx3.init()
        self.engine.setProperty("rate", rate)
        self.engine.setProperty("volume", volume)
        if voice_id:
            self.engine.setProperty("voice", voice_id)

    def speak(self, text: str) -> None:
        self.engine.say(text)
        self.engine.runAndWait()

    async def synthesize(self, text: str) -> bytes:
        return await asyncio.to_thread(self._synthesize_blocking, text)

    def _synthesize_blocking(self, text: str) -> bytes:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            tmp_path = f.name
        try:
            self.engine.save_to_file(text, tmp_path)
            self.engine.runAndWait()
            with open(tmp_path, "rb") as f:
                return f.read()
        finally:
            os.unlink(tmp_path)
