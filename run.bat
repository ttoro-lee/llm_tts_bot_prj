@echo off
echo Starting LLM TTS Bot (background)...
start /B uv run uvicorn server:app > logs\server.log 2>&1
echo PID 저장 중...
timeout /t 2 /nobreak > nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    echo %%a > .pid
    echo Server PID: %%a
    goto :found
)
:found
echo.
echo 서버가 백그라운드에서 실행 중입니다.
echo 로그: logs\server.log
echo 종료: stop.bat
timeout /t 1 /nobreak > nul
start http://localhost:8000
