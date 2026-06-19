@echo off
title Claude Code Launcher

cd /d "C:\Users\aksha\free-claude-code"

start powershell -NoExit -Command "uv run uvicorn server:app --host 0.0.0.0 --port 8082"

timeout /t 5 >nul

cd /d "C:\programing\antigravity\template"

powershell -NoExit -Command "claude"