@echo off
echo Stopping LLM TTS Bot...

if exist .pid (
    set /p PID=<.pid
    taskkill /PID %PID% /F > nul 2>&1
    del .pid
    echo PID %PID% 종료 완료.
) else (
    echo .pid 파일이 없습니다. 포트로 프로세스를 찾습니다...
)

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F > nul 2>&1
    echo PID %%a (포트 8000) 종료 완료.
)

echo 서버가 종료되었습니다.
