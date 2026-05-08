@echo off
REM AI Platform - Windows Setup Launcher
REM Double-click this file to run the automated setup

echo Starting AI Platform Windows Setup...
echo.

REM Run the PowerShell script with execution policy bypass
powershell.exe -ExecutionPolicy Bypass -File "%~dp0windows-setup.ps1"

echo.
echo Press any key to exit...
pause > nul
