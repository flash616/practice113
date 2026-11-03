@echo off
cd /d "%~dp0"
echo Starting Guess or Splash server...
powershell -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause
