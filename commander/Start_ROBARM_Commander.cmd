@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start_ROBARM_Commander.ps1"
if errorlevel 1 pause

