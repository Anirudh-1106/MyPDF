@echo off
REM One-time setup: creates an isolated virtual environment (venv) and installs everything into it.
cd /d "%~dp0"
if not exist venv\Scripts\python.exe (
    echo Creating virtual environment...
    python -m venv venv || (echo Python 3.10+ is required: https://www.python.org/downloads/ & pause & exit /b 1)
)
echo Installing packages into venv (this can take a few minutes)...
venv\Scripts\python.exe -m pip install --upgrade pip
venv\Scripts\python.exe -m pip install -r requirements.txt || (pause & exit /b 1)
venv\Scripts\python.exe tools\make_icons.py
echo Creating desktop shortcut...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\make_shortcut.ps1"
echo.
echo Done! Start MyPDF with the "MyPDF" shortcut on your desktop, or run MyPDF.bat
pause
