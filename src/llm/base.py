from abc import ABC, abstractmethod
from typing import Iterator


class BaseLLM(ABC):
    """LLM 프로바이더 추상 클래스. 새 LLM 추가 시 이 클래스를 상속."""

    @abstractmethod
    def chat(self, messages: list[dict]) -> str:
        """전체 응답을 문자열로 반환."""
        ...

    @abstractmethod
    def stream_chat(self, messages: list[dict]) -> Iterator[str]:
        """응답을 청크 단위로 스트리밍."""
        ...
