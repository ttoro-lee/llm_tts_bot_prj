import asyncio
import os
import tempfile

import pygame
import edge_tts

from .base import BaseTTS


class EdgeTTS(BaseTTS):
    """Microsoft Edge TTS 프로바이더 (온라인, 고품질, 한국어 지원).

    한국어 보이스 목록:
        ko-KR-SunHiNeural  - 여성 (기본값)
        ko-KR-InJoonNeural - 남성

    전체 보이스 목록 확인: uv run edge-tts --list-voices
    """

    def __init__(self, voice: str = "ko-KR-SunHiNeural"):
        self.voice = voice

    def speak(self, text: str) -> None:
        pygame.mixer.init()
        asyncio.run(self._speak_async(text))

    async def _speak_async(self, text: str) -> None:
        audio = await self.synthesize(text)
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
            f.write(audio)
            tmp_path = f.name
        try:
            pygame.mixer.music.load(tmp_path)
            pygame.mixer.music.play()
            while pygame.mixer.music.get_busy():
                pygame.time.Clock().tick(10)
        finally:
            pygame.mixer.music.unload()
            os.unlink(tmp_path)

    async def synthesize(self, text: str) -> bytes:
        communicate = edge_tts.Communicate(text, self.voice)
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
            tmp_path = f.name
        try:
            await communicate.save(tmp_path)
            with open(tmp_path, "rb") as f:
                return f.read()
        finally:
            os.unlink(tmp_path)
