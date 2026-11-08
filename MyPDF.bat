@echo off
REM Starts MyPDF in its own window (no console). Phones on the same Wi-Fi can connect too.
cd /d "%~dp0"
if not exist venv\Scripts\pythonw.exe (
    echo MyPDF is not set up yet - running setup first...
    call setup.bat
)
start "" venv\Scripts\pythonw.exe main.py %*
