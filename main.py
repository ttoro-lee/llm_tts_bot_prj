import os

from dotenv import load_dotenv

from src.llm.base import BaseLLM
from src.tts.base import BaseTTS

load_dotenv()


def build_llm() -> BaseLLM:
    provider = os.getenv("LLM_PROVIDER", "ollama").lower()

    if provider == "ollama":
        from src.llm.ollama_provider import OllamaLLM
        return OllamaLLM(
            model=os.getenv("LLM_MODEL", "gemma4"),
            host=os.getenv("OLLAMA_HOST"),
        )

    raise ValueError(f"지원하지 않는 LLM 프로바이더: {provider}")


def build_tts() -> BaseTTS:
    provider = os.getenv("TTS_PROVIDER", "edge").lower()

    if provider == "edge":
        from src.tts.edge_tts_provider import EdgeTTS
        return EdgeTTS(voice=os.getenv("TTS_VOICE", "ko-KR-SunHiNeural"))

    if provider == "pyttsx3":
        from src.tts.pyttsx3_provider import Pyttsx3TTS
        return Pyttsx3TTS(
            rate=int(os.getenv("TTS_RATE", "150")),
            volume=float(os.getenv("TTS_VOLUME", "1.0")),
            voice_id=os.getenv("TTS_VOICE_ID"),
        )

    raise ValueError(f"지원하지 않는 TTS 프로바이더: {provider}")


def main():
    llm = build_llm()
    tts = build_tts()

    print("=" * 50)
    print(f"LLM : {os.getenv('LLM_PROVIDER', 'ollama')} / {os.getenv('LLM_MODEL', 'gemma4')}")
    print(f"TTS : {os.getenv('TTS_PROVIDER', 'edge')} / {os.getenv('TTS_VOICE', 'ko-KR-SunHiNeural')}")
    print("종료하려면 'quit' 또는 'exit' 입력")
    print("=" * 50)

    system_prompt = os.getenv("SYSTEM_PROMPT", "")
    messages: list[dict] = (
        [{"role": "system", "content": system_prompt}] if system_prompt else []
    )

    while True:
        try:
            user_input = input("\n나: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n종료합니다.")
            break

        if not user_input:
            continue
        if user_input.lower() in ("quit", "exit"):
            print("종료합니다.")
            break

        messages.append({"role": "user", "content": user_input})

        print("Bot: ", end="", flush=True)
        response = llm.chat(messages)
        print(response)

        messages.append({"role": "assistant", "content": response})

        print("[TTS 재생 중...]")
        tts.speak(response)


if __name__ == "__main__":
    main()
