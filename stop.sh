#!/usr/bin/env bash

echo "Stopping LLM TTS Bot..."

# .env에서 SERVER_PORT 읽기 (기본값 8000)
PORT=8000
if [ -f .env ]; then
    _port=$(grep -E '^SERVER_PORT=' .env | cut -d'=' -f2 | tr -d '[:space:]')
    [ -n "$_port" ] && PORT="$_port"
fi

if [ -f .pid ]; then
    PID=$(cat .pid)
    if kill -0 "$PID" 2>/dev/null; then
        kill "$PID"
        echo "PID $PID 종료 완료."
    else
        echo "PID $PID 는 이미 종료되어 있습니다."
    fi
    rm -f .pid
else
    echo ".pid 파일이 없습니다. 포트로 프로세스를 찾습니다..."
    PID=$(lsof -ti tcp:"$PORT" 2>/dev/null || true)
    if [ -n "$PID" ]; then
        kill $PID
        echo "PID $PID (포트 $PORT) 종료 완료."
    else
        echo "포트 $PORT 에서 실행 중인 프로세스가 없습니다."
    fi
fi

echo "서버가 종료되었습니다."
