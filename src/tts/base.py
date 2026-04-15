from abc import ABC, abstractmethod


class BaseTTS(ABC):
    """TTS 프로바이더 추상 클래스. 새 TTS 추가 시 이 클래스를 상속."""

    @abstractmethod
    def speak(self, text: str) -> None:
        """텍스트를 음성으로 재생 (CLI용)."""
        ...

    @abstractmethod
    async def synthesize(self, text: str) -> bytes:
        """텍스트를 오디오 bytes로 변환 (웹 서버용)."""
        ...
