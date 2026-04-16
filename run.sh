#!/usr/bin/env bash
set -e

mkdir -p logs

# .env에서 SERVER_PORT 읽기 (기본값 8000)
PORT=8000
if [ -f .env ]; then
    _port=$(grep -E '^SERVER_PORT=' .env | cut -d'=' -f2 | tr -d '[:space:]')
    [ -n "$_port" ] && PORT="$_port"
fi

echo "Starting LLM TTS Bot on port $PORT (background)..."
nohup uv run uvicorn server:app --port "$PORT" > logs/server.log 2>&1 &
echo $! > .pid
echo "Server PID: $!"
echo ""
echo "서버가 백그라운드에서 실행 중입니다."
echo "포트: $PORT"
echo "로그: logs/server.log"
echo "종료: ./stop.sh"

# 브라우저 열기 (환경에 따라 자동 감지)
sleep 1
if command -v xdg-open &>/dev/null; then
    xdg-open "http://localhost:$PORT"
elif command -v open &>/dev/null; then
    open "http://localhost:$PORT"
fi
